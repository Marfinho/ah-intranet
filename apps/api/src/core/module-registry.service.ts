import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import {
  CORE_MODULE_KEYS,
  MODULE_DEFINITIONS,
  MODULE_KEYS,
  type ModuleState,
  getDependentModules,
  getModule,
  isModuleKey,
} from "@ah-intranet/shared";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import type { RequestUser } from "./request-user";

/**
 * Verwaltet die Feature-Toggles der Fachmodule.
 *
 * Der aktive Zustand wird im Prozess gecacht, weil ihn jeder einzelne Request
 * über den `ModuleEnabledGuard` braucht - ein DB-Roundtrip pro Request wäre
 * pure Verschwendung. Schreibzugriffe invalidieren den Cache sofort, zusätzlich
 * läuft er nach `CACHE_TTL_MS` ab, damit mehrere API-Instanzen konvergieren.
 */
@Injectable()
export class ModuleRegistryService implements OnModuleInit {
  private static readonly CACHE_TTL_MS = 15_000;

  private cache: Set<string> | null = null;
  private cacheExpiresAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Legt fehlende Registry-Einträge an, damit neue Module ohne Migration auftauchen. */
  async onModuleInit(): Promise<void> {
    await this.prisma.moduleSetting.createMany({
      data: MODULE_DEFINITIONS.map((module) => ({ key: module.key, enabled: module.defaultEnabled })),
      skipDuplicates: true,
    });
    this.invalidate();
  }

  invalidate(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  async enabledKeys(): Promise<Set<string>> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    const rows = await this.prisma.moduleSetting.findMany({
      where: { enabled: true },
      select: { key: true },
    });

    // Kernmodule sind immer aktiv, auch wenn jemand die Zeile manuell ändert.
    const enabled = new Set<string>([...CORE_MODULE_KEYS, ...rows.map((row) => row.key)]);
    this.cache = enabled;
    this.cacheExpiresAt = now + ModuleRegistryService.CACHE_TTL_MS;
    return enabled;
  }

  async isEnabled(key: string): Promise<boolean> {
    return (await this.enabledKeys()).has(key);
  }

  /** Vollständiger Zustand für die Adminoberfläche. */
  async list(): Promise<ModuleState[]> {
    const rows = await this.prisma.moduleSetting.findMany();
    const byKey = new Map(rows.map((row) => [row.key, row]));

    return MODULE_DEFINITIONS.map((module) => {
      const row = byKey.get(module.key);
      return {
        key: module.key,
        label: module.label,
        description: module.description,
        href: module.href,
        icon: module.icon,
        group: module.group,
        core: module.core,
        dependsOn: [...module.dependsOn],
        enabled: module.core ? true : (row?.enabled ?? module.defaultEnabled),
        updatedAt: row?.updatedAt.toISOString() ?? null,
        updatedBy: row?.updatedBy ?? null,
        blocks: getDependentModules(module.key).map((dependent) => dependent.key),
      };
    });
  }

  /**
   * Schaltet ein Modul um und hält dabei die Abhängigkeiten konsistent:
   * Aktivieren zieht benötigte Vormodule mit, Deaktivieren schaltet abhängige ab.
   */
  async setEnabled(key: string, enabled: boolean, actor: RequestUser): Promise<ModuleState[]> {
    if (!isModuleKey(key)) {
      throw new NotFoundException(`Unbekanntes Modul: ${key}`);
    }

    const definition = getModule(key)!;
    if (definition.core) {
      throw new BadRequestException(`${definition.label} ist ein Kernmodul und kann nicht deaktiviert werden.`);
    }

    const affected = new Map<string, boolean>([[key, enabled]]);

    if (enabled) {
      for (const dependency of definition.dependsOn as readonly string[]) {
        affected.set(dependency, true);
      }
    } else {
      // Abhängige Module rekursiv mit abschalten (z. B. Freigaben, wenn Bestellungen aus sind).
      const queue: string[] = [key];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const dependent of getDependentModules(current)) {
          if (!dependent.core && !affected.has(dependent.key)) {
            affected.set(dependent.key, false);
            queue.push(dependent.key);
          }
        }
      }
    }

    await this.prisma.$transaction(
      [...affected].map(([moduleKey, moduleEnabled]) =>
        this.prisma.moduleSetting.upsert({
          where: { key: moduleKey },
          update: { enabled: moduleEnabled, updatedBy: actor.username },
          create: { key: moduleKey, enabled: moduleEnabled, updatedBy: actor.username },
        }),
      ),
    );

    this.invalidate();

    await this.audit.log({
      actor,
      action: enabled ? "module.enable" : "module.disable",
      entityType: "module",
      entityId: key,
      detail: `${definition.label} ${enabled ? "aktiviert" : "deaktiviert"}`,
      metadata: { affected: Object.fromEntries(affected) },
    });

    return this.list();
  }

  /** Setzt alle Module auf ihren Auslieferungszustand zurück. */
  async resetToDefaults(actor: RequestUser): Promise<ModuleState[]> {
    await this.prisma.$transaction(
      MODULE_DEFINITIONS.map((module) =>
        this.prisma.moduleSetting.upsert({
          where: { key: module.key },
          update: { enabled: module.defaultEnabled, updatedBy: actor.username },
          create: { key: module.key, enabled: module.defaultEnabled, updatedBy: actor.username },
        }),
      ),
    );
    this.invalidate();

    await this.audit.log({
      actor,
      action: "module.reset",
      entityType: "module",
      entityId: "*",
      detail: `Alle ${MODULE_KEYS.length} Module auf Standard zurückgesetzt`,
    });

    return this.list();
  }
}
