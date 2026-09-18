import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  AVAILABILITY_LABELS,
  CONNECTOR_DEFINITIONS,
  getCapability,
  getConnector,
  isConnectorKey,
  isRunnable,
  type ConnectorDefinition,
  type ConnectorState,
  type SyncRunSummary,
  type VehicleListing,
} from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { toIso } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";
import { IntegrationCryptoService } from "./crypto.service";
import { ConnectorError, type ConnectorAdapter, type ConnectorContext } from "./adapter";
import { MobileDeAdapter } from "./adapters/mobile-de.adapter";
import { DmsFileAdapter } from "./adapters/dms-file.adapter";
import { DatevAdapter } from "./adapters/datev.adapter";
import { PortalLinkAdapter } from "./adapters/portal.adapter";

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly adapters = new Map<string, ConnectorAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: IntegrationCryptoService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    mobileDe: MobileDeAdapter,
    dmsFile: DmsFileAdapter,
    private readonly datev: DatevAdapter,
    private readonly portal: PortalLinkAdapter,
  ) {
    // Nur Systeme mit offen zugänglicher Spezifikation bekommen einen Adapter.
    this.adapters.set(mobileDe.key, mobileDe);
    this.adapters.set(dmsFile.key, dmsFile);
    this.adapters.set(datev.key, datev);
  }

  /** Portalkonnektoren teilen sich einen Adapter, Fachkonnektoren haben eigene. */
  private adapterFor(definition: ConnectorDefinition): ConnectorAdapter | null {
    if (definition.availability === "portal_link") {
      return this.portal;
    }
    return this.adapters.get(definition.key) ?? null;
  }

  /* ------------------------------------------------------------ Lesen */

  async list(): Promise<ConnectorState[]> {
    const rows = await this.prisma.connector.findMany();
    const byKey = new Map(rows.map((row) => [row.key, row]));

    const lastRuns = await this.prisma.syncRun.findMany({
      where: { connectorKey: { in: CONNECTOR_DEFINITIONS.map((entry) => entry.key) } },
      orderBy: { startedAt: "desc" },
      distinct: ["connectorKey"],
    });
    const runByConnector = new Map(lastRuns.map((run) => [run.connectorKey, run]));

    return CONNECTOR_DEFINITIONS.map((definition) => {
      const row = byKey.get(definition.key);
      const run = runByConnector.get(definition.key);
      return this.toState(definition, row, run ? this.toRunSummary(run) : null);
    });
  }

  async detail(key: string): Promise<ConnectorState> {
    const definition = this.requireDefinition(key);
    const row = await this.prisma.connector.findUnique({ where: { key } });
    const run = await this.prisma.syncRun.findFirst({
      where: { connectorKey: key },
      orderBy: { startedAt: "desc" },
    });
    return this.toState(definition, row ?? undefined, run ? this.toRunSummary(run) : null);
  }

  async runs(filter: { connectorKey?: string; take?: number } = {}): Promise<SyncRunSummary[]> {
    const rows = await this.prisma.syncRun.findMany({
      where: filter.connectorKey ? { connectorKey: filter.connectorKey } : {},
      orderBy: { startedAt: "desc" },
      take: filter.take ?? 100,
    });
    return rows.map((row) => this.toRunSummary(row));
  }

  async listings(filter: { search?: string; source?: string } = {}) {
    const where: Prisma.VehicleListingWhereInput = {
      ...(filter.source && filter.source !== "all" ? { connectorKey: filter.source } : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" } },
              { make: { contains: filter.search, mode: "insensitive" } },
              { model: { contains: filter.search, mode: "insensitive" } },
              { vin: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, sources] = await Promise.all([
      this.prisma.vehicleListing.findMany({ where, orderBy: [{ make: "asc" }, { model: "asc" }], take: 500 }),
      this.prisma.vehicleListing.findMany({ distinct: ["connectorKey"], select: { connectorKey: true } }),
    ]);

    const items: VehicleListing[] = rows.map((row) => ({
      id: row.id,
      source: row.connectorKey,
      sourceName: getConnector(row.connectorKey)?.name ?? row.connectorKey,
      externalId: row.externalId,
      vin: row.vin,
      make: row.make,
      model: row.model,
      title: row.title,
      price: row.price === null ? null : Number(row.price),
      currency: row.currency,
      mileageKm: row.mileageKm,
      firstRegistration: toIso(row.firstRegistration),
      fuel: row.fuel,
      gearbox: row.gearbox,
      powerKw: row.powerKw,
      url: row.url,
      imageUrl: row.imageUrl,
      syncedAt: row.syncedAt.toISOString(),
    }));

    return {
      items,
      sources: sources.map((entry) => ({
        key: entry.connectorKey,
        name: getConnector(entry.connectorKey)?.name ?? entry.connectorKey,
      })),
    };
  }

  /* --------------------------------------------------------- Schreiben */

  /**
   * Speichert Konfiguration und Zugangsdaten. Leere Geheimfelder lassen den
   * bestehenden Wert unangetastet, damit die Oberfläche Passwörter nie
   * zurücklesen muss.
   */
  async saveConfig(
    key: string,
    input: { settings: Record<string, string>; secrets: Record<string, string> },
    actor: RequestUser,
  ): Promise<ConnectorState> {
    const definition = this.requireDefinition(key);
    const existing = await this.prisma.connector.findUnique({ where: { key } });

    // Beide Seiten werden auf den Bestand aufgesetzt: wer nur das Passwort
    // ändert, darf damit nicht den Endpunkt verlieren. Ein leerer String löscht
    // ein Feld ausdrücklich, ein fehlender Schlüssel lässt es unverändert.
    const settings: Record<string, string> = {
      ...((existing?.settings as Record<string, string> | null) ?? {}),
    };
    const secrets: Record<string, string> = {
      ...((existing?.secrets as Record<string, string> | null) ?? {}),
    };

    for (const field of definition.fields) {
      const target = field.secret ? secrets : settings;
      const value = field.secret ? input.secrets[field.key] : input.settings[field.key];

      if (typeof value !== "string") {
        continue;
      }
      if (value.trim().length === 0) {
        delete target[field.key];
      } else {
        target[field.key] = field.secret ? this.crypto.encrypt(value) : value.trim();
      }
    }

    const missing = definition.fields.filter(
      (field) => field.required && !(field.secret ? secrets[field.key] : settings[field.key]),
    );

    const status = missing.length === 0 ? "configured" : "not_configured";

    const row = await this.prisma.connector.upsert({
      where: { key },
      update: { settings, secrets: secrets as Prisma.InputJsonValue, status, updatedBy: actor.username },
      create: {
        key,
        settings,
        secrets: secrets as Prisma.InputJsonValue,
        status,
        updatedBy: actor.username,
      },
    });

    await this.audit.log({
      actor,
      action: "connector.configure",
      entityType: "connector",
      entityId: key,
      detail: `Schnittstelle "${definition.name}" konfiguriert (${status === "configured" ? "vollständig" : `es fehlen: ${missing.map((field) => field.label).join(", ")}`})`,
    });

    return this.toState(definition, row, null);
  }

  async setEnabled(key: string, enabled: boolean, actor: RequestUser): Promise<ConnectorState> {
    const definition = this.requireDefinition(key);
    const existing = await this.prisma.connector.findUnique({ where: { key } });
    if (!existing) {
      throw new BadRequestException("Diese Schnittstelle ist noch nicht konfiguriert.");
    }

    const complete = definition.fields
      .filter((field) => field.required)
      .every((field) =>
        field.secret
          ? Boolean((existing.secrets as Record<string, string>)[field.key])
          : Boolean((existing.settings as Record<string, string>)[field.key]),
      );

    const row = await this.prisma.connector.update({
      where: { key },
      data: { status: enabled ? (complete ? "configured" : "not_configured") : "disabled", updatedBy: actor.username },
    });

    await this.audit.log({
      actor,
      action: enabled ? "connector.enable" : "connector.disable",
      entityType: "connector",
      entityId: key,
      detail: `Schnittstelle "${definition.name}" ${enabled ? "aktiviert" : "deaktiviert"}`,
    });

    return this.toState(definition, row, null);
  }

  /* ---------------------------------------------------------- Ausführen */

  async check(key: string, actor: RequestUser): Promise<{ ok: boolean; message: string }> {
    const definition = this.requireDefinition(key);
    const adapter = this.requireAdapter(definition);
    const context = await this.buildContext(definition);

    let result: { ok: boolean; message: string };
    try {
      result = await adapter.check(context);
    } catch (error) {
      result = { ok: false, message: this.describe(error) };
    }

    await this.prisma.connector.upsert({
      where: { key },
      update: { lastCheckAt: new Date(), lastCheckOk: result.ok, lastCheckMessage: result.message },
      create: {
        key,
        lastCheckAt: new Date(),
        lastCheckOk: result.ok,
        lastCheckMessage: result.message,
      },
    });

    await this.audit.log({
      actor,
      action: "connector.check",
      entityType: "connector",
      entityId: key,
      detail: `Verbindungstest "${definition.name}": ${result.ok ? "erfolgreich" : "fehlgeschlagen"} – ${result.message}`,
    });

    return result;
  }

  /**
   * Führt eine Fähigkeit aus und protokolliert den Lauf vollständig - auch
   * wenn er scheitert. Ein stiller Fehlschlag wäre bei Datenabgleichen das
   * gefährlichste Ergebnis.
   */
  async run(key: string, capability: string, actor: RequestUser): Promise<SyncRunSummary> {
    const definition = this.requireDefinition(key);
    const capabilityDefinition = getCapability(key, capability);

    if (!capabilityDefinition) {
      throw new NotFoundException(`Unbekannte Fähigkeit "${capability}".`);
    }
    if (!capabilityDefinition.implemented) {
      throw new BadRequestException(
        `"${capabilityDefinition.label}" ist nicht umgesetzt: ${AVAILABILITY_LABELS[definition.availability]}. ` +
          "Sobald Vertrag und Spezifikation vorliegen, lässt sich der Adapter ergänzen.",
      );
    }

    const adapter = this.requireAdapter(definition);
    const context = await this.buildContext(definition);

    const run = await this.prisma.syncRun.create({
      data: {
        connectorKey: key,
        capability,
        direction: capabilityDefinition.direction,
        status: "running",
        triggeredBy: actor.username,
      },
    });

    try {
      const result = await adapter.run(capability, context);

      const finished = await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: "succeeded",
          finishedAt: new Date(),
          itemsProcessed: result.itemsProcessed,
          itemsFailed: result.itemsFailed,
          message: result.message,
          detailJson: (result.detail ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      await this.audit.log({
        actor,
        action: "connector.sync",
        entityType: "connector",
        entityId: key,
        detail: `${definition.name} – ${capabilityDefinition.label}: ${result.message}`,
      });

      return this.toRunSummary(finished);
    } catch (error) {
      const message = this.describe(error);
      this.logger.error(`Sync ${key}/${capability} fehlgeschlagen: ${message}`);

      const finished = await this.prisma.syncRun.update({
        where: { id: run.id },
        data: { status: "failed", finishedAt: new Date(), message },
      });

      await this.audit.log({
        actor,
        action: "connector.sync_failed",
        entityType: "connector",
        entityId: key,
        detail: `${definition.name} – ${capabilityDefinition.label} fehlgeschlagen: ${message}`,
      });

      // Administration informieren: ein gescheiterter Abgleich fällt sonst erst
      // auf, wenn jemand veraltete Bestände bemerkt.
      await this.notifications.notify({
        userIds: await this.notifications.userIdsWithRole("admin"),
        title: `Schnittstelle ${definition.name}: Abgleich fehlgeschlagen`,
        detail: message,
        link: "/admin/schnittstellen",
      });

      return this.toRunSummary(finished);
    }
  }

  /** Buchungsstapel erzeugen, ohne ihn als Lauf zu protokollieren. */
  async datevPreview(actor: RequestUser) {
    const definition = this.requireDefinition("datev");
    const context = await this.buildContext(definition);
    const range = this.datev.defaultRange();
    return this.datev.generate(context, range, actor.displayName);
  }

  /* ------------------------------------------------------------ Helfer */

  private requireDefinition(key: string): ConnectorDefinition {
    if (!isConnectorKey(key)) {
      throw new NotFoundException(`Unbekannte Schnittstelle: ${key}`);
    }
    return getConnector(key)!;
  }

  private requireAdapter(definition: ConnectorDefinition): ConnectorAdapter {
    const adapter = this.adapterFor(definition);
    if (!adapter) {
      throw new BadRequestException(
        `Für "${definition.name}" gibt es keinen Adapter: ${AVAILABILITY_LABELS[definition.availability]}. ` +
          definition.onboarding.join(" "),
      );
    }
    return adapter;
  }

  private async buildContext(definition: ConnectorDefinition): Promise<ConnectorContext> {
    const row = await this.prisma.connector.findUnique({ where: { key: definition.key } });
    if (row?.status === "disabled") {
      throw new BadRequestException(`Die Schnittstelle "${definition.name}" ist deaktiviert.`);
    }

    const settings = ((row?.settings as Record<string, string> | null) ?? {}) as Record<string, string>;
    const encrypted = ((row?.secrets as Record<string, string> | null) ?? {}) as Record<string, string>;

    const secrets: Record<string, string> = {};
    for (const [field, value] of Object.entries(encrypted)) {
      secrets[field] = this.crypto.decrypt(value);
    }

    return { definition, settings, secrets };
  }

  private toState(
    definition: ConnectorDefinition,
    row:
      | {
          status: string;
          settings: unknown;
          secrets: unknown;
          lastCheckAt: Date | null;
          lastCheckOk: boolean | null;
          lastCheckMessage: string | null;
          updatedBy: string | null;
        }
      | undefined,
    lastRun: SyncRunSummary | null,
  ): ConnectorState {
    const settings = ((row?.settings as Record<string, string> | null) ?? {}) as Record<string, string>;
    const secrets = ((row?.secrets as Record<string, string> | null) ?? {}) as Record<string, string>;

    return {
      key: definition.key,
      name: definition.name,
      vendor: definition.vendor,
      category: definition.category,
      availability: definition.availability,
      direction: definition.direction,
      summary: definition.summary,
      docsUrl: definition.docsUrl,
      portalUrl: settings.portalUrl ?? definition.portalUrl,
      capabilities: [...definition.capabilities],
      fields: [...definition.fields],
      onboarding: [...definition.onboarding],
      status: (row?.status as ConnectorState["status"]) ?? "not_configured",
      runnable: isRunnable(definition) || definition.availability === "portal_link",
      settings,
      secretsSet: Object.keys(secrets),
      lastCheckAt: toIso(row?.lastCheckAt ?? null),
      lastCheckOk: row?.lastCheckOk ?? null,
      lastCheckMessage: row?.lastCheckMessage ?? null,
      updatedBy: row?.updatedBy ?? null,
      lastRun,
    };
  }

  private toRunSummary(run: {
    id: string;
    connectorKey: string;
    capability: string;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    itemsProcessed: number;
    itemsFailed: number;
    message: string | null;
    triggeredBy: string | null;
  }): SyncRunSummary {
    return {
      id: run.id,
      connectorKey: run.connectorKey,
      connectorName: getConnector(run.connectorKey)?.name ?? run.connectorKey,
      capability: getCapability(run.connectorKey, run.capability)?.label ?? run.capability,
      status: run.status as SyncRunSummary["status"],
      startedAt: run.startedAt.toISOString(),
      finishedAt: toIso(run.finishedAt),
      durationMs: run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null,
      itemsProcessed: run.itemsProcessed,
      itemsFailed: run.itemsFailed,
      message: run.message,
      triggeredBy: run.triggeredBy,
    };
  }

  private describe(error: unknown): string {
    if (error instanceof ConnectorError) {
      return error.message;
    }
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      return error.message;
    }
    return error instanceof Error ? error.message : "Unbekannter Fehler";
  }
}
