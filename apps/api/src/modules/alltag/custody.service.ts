import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CustodyItemSummary, CustodyKind, CustodyStatus } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { pruefeReferenz } from "../../core/referenzen";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { displayName, toIso } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";

const itemInclude = {
  location: { select: { name: true } },
  holder: { select: { firstName: true, lastName: true } },
  events: {
    include: {
      person: { select: { firstName: true, lastName: true } },
      actor: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

export interface CustodyInput {
  kind: CustodyKind;
  title: string;
  description?: string | null;
  storagePlace?: string | null;
  locationId?: string | null;
  foundAt?: string | null;
  foundPlace?: string | null;
}

/**
 * Fundsachen und Schlüssel.
 *
 * Der Zustand beantwortet "wer hat den Schlüssel", der Verlauf beantwortet
 * "wer hatte ihn im März". Beides wird gebraucht, deshalb schreibt jede
 * Bewegung einen Eintrag, statt nur ein Feld zu überschreiben.
 */
@Injectable()
export class CustodyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(filter: { kind?: string; status?: string; search?: string } = {}): Promise<CustodyItemSummary[]> {
    const items = await this.prisma.custodyItem.findMany({
      where: {
        AND: [
          filter.kind && filter.kind !== "all" ? { kind: filter.kind as CustodyKind } : {},
          filter.status && filter.status !== "all" ? { status: filter.status as CustodyStatus } : {},
          filter.search
            ? {
                OR: [
                  { title: { contains: filter.search, mode: "insensitive" as const } },
                  { description: { contains: filter.search, mode: "insensitive" as const } },
                  { foundPlace: { contains: filter.search, mode: "insensitive" as const } },
                ],
              }
            : {},
        ],
      },
      include: itemInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return items.map((item) => this.toSummary(item));
  }

  async create(user: RequestUser, input: CustodyInput): Promise<CustodyItemSummary> {
    if (input.kind === "fundsache" && !input.foundPlace?.trim()) {
      throw new BadRequestException("Bei einer Fundsache gehört der Fundort dazu - ohne ihn ist die Rückgabe Glück.");
    }

    // Der Standort kommt aus den Anfragedaten und muss zum eigenen Haus
    // gehören - der Fremdschlüssel allein nimmt auch eine fremde Kennung an.
    await pruefeReferenz({ modell: this.prisma.location, id: input.locationId, bezeichnung: "Der Standort" });

    const item = await this.prisma.custodyItem.create({
      data: {
        kind: input.kind,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        storagePlace: input.storagePlace?.trim() || null,
        locationId: input.locationId || null,
        foundAt: input.foundAt ? new Date(input.foundAt) : input.kind === "fundsache" ? new Date() : null,
        foundPlace: input.foundPlace?.trim() || null,
        createdById: user.id,
        events: { create: { kind: "aufgenommen", actorId: user.id, note: input.storagePlace?.trim() || null } },
      },
      include: itemInclude,
    });

    await this.audit.log({
      actor: user,
      action: "custody.created",
      entityType: "custody_item",
      entityId: item.id,
      detail: `${input.kind === "schluessel" ? "Schlüssel" : "Fundsache"} "${item.title}" aufgenommen`,
    });

    return this.toSummary(item);
  }

  /**
   * Ausgabe an eine Person.
   *
   * `personId` für Konten des Hauses, `personName` für alle anderen - eine
   * Kundin, die ihr Handy abholt, hat kein Konto. Ohne das zweite Feld würde
   * die Übergabe gar nicht erst festgehalten.
   */
  async handOut(
    user: RequestUser,
    id: string,
    input: { personId?: string | null; personName?: string | null; note?: string | null },
  ): Promise<CustodyItemSummary> {
    const item = await this.prisma.custodyItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Eintrag nicht gefunden");
    }
    if (item.status !== "verwahrt") {
      throw new BadRequestException(`Dieser Eintrag ist nicht verwahrt, sondern "${item.status}".`);
    }

    const person = await this.personPruefen(input.personId, input.personName);

    await this.prisma.$transaction(async (tx) => {
      await tx.custodyItem.update({
        where: { id },
        data: {
          status: item.kind === "schluessel" ? "ausgegeben" : "abgeholt",
          holderId: item.kind === "schluessel" ? input.personId || null : null,
        },
      });
      await tx.custodyEvent.create({
        data: {
          itemId: id,
          kind: item.kind === "schluessel" ? "ausgegeben" : "abgeholt",
          personId: input.personId || null,
          personName: input.personId ? null : person,
          note: input.note?.trim() || null,
          actorId: user.id,
        },
      });
    });

    await this.audit.log({
      actor: user,
      action: "custody.handed_out",
      entityType: "custody_item",
      entityId: id,
      detail: `"${item.title}" an ${person} übergeben`,
    });

    if (input.personId && item.kind === "schluessel") {
      await this.notifications.notify({
        userIds: [input.personId],
        title: `Schlüssel übernommen: ${item.title}`,
        detail: "Bitte bei Rückgabe wieder im Intranet abmelden.",
        link: "/verwahrung",
      });
    }

    return this.einzeln(id);
  }

  /** Rücknahme eines Schlüssels; Fundsachen kommen nicht zurück. */
  async takeBack(user: RequestUser, id: string, note?: string): Promise<CustodyItemSummary> {
    const item = await this.prisma.custodyItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Eintrag nicht gefunden");
    }
    if (item.status !== "ausgegeben") {
      throw new BadRequestException("Zurücknehmen lässt sich nur, was ausgegeben ist.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.custodyItem.update({ where: { id }, data: { status: "verwahrt", holderId: null } });
      await tx.custodyEvent.create({
        data: {
          itemId: id,
          kind: "zurueckgenommen",
          personId: item.holderId,
          note: note?.trim() || null,
          actorId: user.id,
        },
      });
    });

    await this.audit.log({
      actor: user,
      action: "custody.taken_back",
      entityType: "custody_item",
      entityId: id,
      detail: `"${item.title}" zurückgenommen`,
    });

    return this.einzeln(id);
  }

  async discard(user: RequestUser, id: string, note?: string): Promise<CustodyItemSummary> {
    const item = await this.prisma.custodyItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Eintrag nicht gefunden");
    }
    if (item.status === "entsorgt") {
      throw new BadRequestException("Dieser Eintrag ist bereits entsorgt.");
    }
    if (item.status === "ausgegeben") {
      throw new BadRequestException("Ein ausgegebener Schlüssel wird erst zurückgenommen, dann entsorgt.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.custodyItem.update({ where: { id }, data: { status: "entsorgt", holderId: null } });
      await tx.custodyEvent.create({
        data: { itemId: id, kind: "entsorgt", note: note?.trim() || null, actorId: user.id },
      });
    });

    await this.audit.log({
      actor: user,
      action: "custody.discarded",
      entityType: "custody_item",
      entityId: id,
      detail: `"${item.title}" entsorgt${note ? ` (${note})` : ""}`,
    });

    return this.einzeln(id);
  }

  /* ------------------------------------------------------------- Helfer */

  private async personPruefen(personId?: string | null, personName?: string | null): Promise<string> {
    if (personId) {
      // Scoped gesucht: eine Kennung aus der Anfrage darf nicht in ein
      // fremdes Haus zeigen.
      const konto = await this.prisma.user.findFirst({
        where: { id: personId, status: "active" },
        select: { firstName: true, lastName: true },
      });
      if (!konto) {
        throw new BadRequestException("Die angegebene Person ist in diesem Haus nicht verfügbar.");
      }
      return displayName(konto);
    }
    const name = personName?.trim();
    if (!name) {
      throw new BadRequestException("Ohne Empfängerin oder Empfänger ist die Übergabe nicht nachvollziehbar.");
    }
    return name;
  }

  private async einzeln(id: string): Promise<CustodyItemSummary> {
    const item = await this.prisma.custodyItem.findUniqueOrThrow({ where: { id }, include: itemInclude });
    return this.toSummary(item);
  }

  private toSummary(item: {
    id: string;
    kind: string;
    title: string;
    description: string | null;
    storagePlace: string | null;
    status: string;
    foundAt: Date | null;
    foundPlace: string | null;
    createdAt: Date;
    location: { name: string } | null;
    holder: { firstName: string; lastName: string } | null;
    events: {
      id: string;
      kind: string;
      note: string | null;
      personName: string | null;
      createdAt: Date;
      person: { firstName: string; lastName: string } | null;
      actor: { firstName: string; lastName: string };
    }[];
  }): CustodyItemSummary {
    return {
      id: item.id,
      kind: item.kind as CustodyKind,
      title: item.title,
      description: item.description,
      storagePlace: item.storagePlace,
      location: item.location?.name ?? null,
      status: item.status as CustodyStatus,
      holder: item.holder ? displayName(item.holder) : null,
      foundAt: toIso(item.foundAt),
      foundPlace: item.foundPlace,
      createdAt: toIso(item.createdAt)!,
      events: item.events.map((event) => ({
        id: event.id,
        kind: event.kind as CustodyItemSummary["events"][number]["kind"],
        person: event.person ? displayName(event.person) : event.personName,
        note: event.note,
        actor: displayName(event.actor),
        createdAt: toIso(event.createdAt)!,
      })),
    };
  }
}
