import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
import { requireTenantId } from "./tenant-context";

/**
 * Verwaltet die Feature-Toggles der Fachmodule.
 *
 * Der aktive Zustand wird im Prozess gecacht, weil ihn jeder einzelne Request
 * über den `ModuleEnabledGuard` braucht - ein DB-Roundtrip pro Request wäre
 * pure Verschwendung. Schreibzugriffe invalidieren den Cache sofort, zusätzlich
 * läuft er nach `CACHE_TTL_MS` ab, damit mehrere API-Instanzen konvergieren.
 */
@Injectable()
export class ModuleRegistryService {
  private static readonly CACHE_TTL_MS = 15_000;

  /**
   * Cache je Mandant. Ein gemeinsamer Cache würde die Modulauswahl eines
   * Autohauses auf ein anderes übertragen - genau die Art Fehler, die bei
   * Mehrmandantenfähigkeit teuer wird.
   */
  private readonly cache = new Map<string, { keys: Set<string>; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  invalidate(): void {
    this.cache.delete(requireTenantId());
  }

  /**
   * Aktive Module des laufenden Mandanten.
   *
   * Fehlt zu einem Modul eine Zeile - etwa weil es nach dem Anlegen des
   * Mandanten hinzugekommen ist - gilt die Vorgabe aus der Registry. So taucht
   * ein neues Modul ohne Migration auf.
   */
  async enabledKeys(): Promise<Set<string>> {
    const tenantId = requireTenantId();
    const hit = this.cache.get(tenantId);
    if (hit && Date.now() < hit.expiresAt) {
      return hit.keys;
    }

    const rows = await this.prisma.moduleSetting.findMany({ select: { key: true, enabled: true } });
    const gesetzt = new Map(rows.map((row) => [row.key, row.enabled]));

    const keys = new Set<string>(CORE_MODULE_KEYS);
    for (const module of MODULE_DEFINITIONS) {
      if (gesetzt.get(module.key) ?? module.defaultEnabled) {
        keys.add(module.key);
      }
    }

    this.cache.set(tenantId, { keys, expiresAt: Date.now() + ModuleRegistryService.CACHE_TTL_MS });
    return keys;
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
          where: { tenantId_key: { tenantId: actor.tenantId, key: moduleKey } },
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
          where: { tenantId_key: { tenantId: actor.tenantId, key: module.key } },
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
