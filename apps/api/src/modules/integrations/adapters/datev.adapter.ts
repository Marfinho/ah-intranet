import { Injectable } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../../../core/prisma.service";
import {
  ConnectorError,
  requireFields,
  type CheckResult,
  type ConnectorAdapter,
  type ConnectorContext,
  type SyncResult,
} from "../adapter";
import { buildBuchungsstapel, datevFileName, toDatevBuffer, type DatevBooking } from "./datev.builder";

export interface DatevExportRange {
  from: Date;
  to: Date;
}

/**
 * Erzeugt aus abgeschlossenen Bestellungen einen DATEV-Buchungsstapel.
 *
 * Gebucht wird je Bestellung ein Satz: Aufwandskonto im Soll gegen das
 * konfigurierte Gegenkonto. Ohne hinterlegten Rechnungsbetrag entsteht kein
 * Buchungssatz - ein Stapel mit geratenen Beträgen wäre schlimmer als keiner.
 */
@Injectable()
export class DatevAdapter implements ConnectorAdapter {
  readonly key = "datev";

  constructor(private readonly prisma: PrismaService) {}

  async check(context: ConnectorContext): Promise<CheckResult> {
    requireFields(context, [
      "consultantNumber",
      "clientNumber",
      "expenseAccountBusinessCards",
      "expenseAccountWorkwear",
      "counterAccount",
    ]);

    const range = this.defaultRange();
    const pending = await this.countExportable(range);
    const withoutAmount = await this.prisma.order.count({
      where: { status: "completed", completedAt: { gte: range.from, lte: range.to }, netAmount: null },
    });

    return {
      ok: true,
      message:
        `Konfiguration vollständig. Im Zeitraum ${range.from.toISOString().slice(0, 10)} bis ` +
        `${range.to.toISOString().slice(0, 10)}: ${pending} buchbare Vorgänge` +
        (withoutAmount > 0 ? `, ${withoutAmount} ohne Rechnungsbetrag (werden übersprungen)` : "") +
        ".",
    };
  }

  async run(capability: string, context: ConnectorContext): Promise<SyncResult> {
    if (capability !== "bookings.export") {
      throw new ConnectorError(`Unbekannte Fähigkeit "${capability}" für DATEV.`);
    }

    const range = this.defaultRange();
    const { content, count, skipped } = await this.generate(context, range);

    if (count === 0) {
      return {
        itemsProcessed: 0,
        itemsFailed: skipped,
        message: "Keine buchbaren Vorgänge im Zeitraum – es wurde keine Datei erzeugt.",
      };
    }

    const directory = context.settings.exportDirectory?.trim();
    let path: string | null = null;

    if (directory) {
      try {
        await mkdir(directory, { recursive: true });
        path = join(directory, datevFileName(range.from, range.to));
        await writeFile(path, toDatevBuffer(content));
      } catch (error) {
        throw new ConnectorError(`Stapel konnte nicht geschrieben werden: ${(error as Error).message}`);
      }
    }

    return {
      itemsProcessed: count,
      itemsFailed: skipped,
      message:
        `${count} Buchungssatz/-sätze erzeugt` +
        (path ? `, abgelegt unter ${path}` : ", zum Download bereit") +
        (skipped > 0 ? `, ${skipped} ohne Rechnungsbetrag übersprungen` : "") +
        ".",
      detail: { path, from: range.from.toISOString(), to: range.to.toISOString() },
    };
  }

  /**
   * Baut den Stapel. Wird sowohl vom Sync-Lauf als auch vom Download-Endpunkt
   * genutzt, damit Datei und Vorschau garantiert identisch sind.
   */
  async generate(
    context: ConnectorContext,
    range: DatevExportRange,
    exportedBy = "Intranet",
  ): Promise<{ content: string; count: number; skipped: number; fileName: string }> {
    requireFields(context, [
      "consultantNumber",
      "clientNumber",
      "expenseAccountBusinessCards",
      "expenseAccountWorkwear",
      "counterAccount",
    ]);

    const orders = await this.prisma.order.findMany({
      where: { status: "completed", completedAt: { gte: range.from, lte: range.to } },
      include: { requester: { select: { firstName: true, lastName: true } } },
      orderBy: { completedAt: "asc" },
    });

    const counterAccount = context.settings.counterAccount.trim();
    const buKey = context.settings.buKey?.trim() || undefined;
    const bookings: DatevBooking[] = [];
    let skipped = 0;

    for (const order of orders) {
      if (order.netAmount === null) {
        skipped += 1;
        continue;
      }

      const account =
        order.type === "business_card"
          ? context.settings.expenseAccountBusinessCards.trim()
          : context.settings.expenseAccountWorkwear.trim();

      bookings.push({
        amount: Number(order.netAmount),
        // Aufwand im Soll gegen Kreditor bzw. Verrechnungskonto.
        debitCredit: "S",
        account,
        counterAccount,
        buKey,
        date: order.completedAt ?? order.updatedAt,
        documentField1: order.supplierInvoice ?? order.orderNumber,
        text: `${order.orderNumber} ${order.type === "business_card" ? "Visitenkarten" : "Arbeitskleidung"} ${order.requester.lastName}`,
      });
    }

    const content = buildBuchungsstapel(bookings, {
      consultantNumber: Number(context.settings.consultantNumber),
      clientNumber: Number(context.settings.clientNumber),
      accountLength: context.settings.accountLength ? Number(context.settings.accountLength) : undefined,
      fiscalStart: context.settings.fiscalStart,
      from: range.from,
      to: range.to,
      description: "Autohaus Intranet Bestellungen",
      exportedBy,
    });

    return { content, count: bookings.length, skipped, fileName: datevFileName(range.from, range.to) };
  }

  private async countExportable(range: DatevExportRange): Promise<number> {
    return this.prisma.order.count({
      where: { status: "completed", completedAt: { gte: range.from, lte: range.to }, netAmount: { not: null } },
    });
  }

  /** Standardzeitraum ist der Vormonat - der übliche Rhythmus zur Kanzlei. */
  defaultRange(): DatevExportRange {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59));
    return { from, to };
  }
}
