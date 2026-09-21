import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from "@ah-intranet/shared";
import type { TenantContext } from "./tenant-context";

/**
 * Löst den Mandanten einer Anfrage auf.
 *
 * Nutzt bewusst einen eigenen, ungefilterten Client: die Mandantentabelle darf
 * nicht dem Mandantenfilter unterliegen, und zum Zeitpunkt der Auflösung steht
 * der Mandant noch gar nicht fest.
 */
@Injectable()
export class TenantService implements OnModuleInit {
  private readonly client = new PrismaClient();
  private readonly logger = new Logger(TenantService.name);

  /**
   * Gleicht den Rechtekatalog beim Start in jedes Haus ab.
   *
   * Rechte stehen in der Registry, aber jedes Haus führt eigene Zeilen - sonst
   * ließen sie sich nicht an Rollen hängen. Ein neues Recht in der Registry
   * muss deshalb ankommen, ohne dass jemand eine Migration schreibt. Rollen
   * bleiben unangetastet: welche Rolle das neue Recht bekommt, entscheidet das
   * Haus.
   */
  async onModuleInit(): Promise<void> {
    const tenants = await this.client.tenant.findMany({ select: { id: true, slug: true } });
    for (const tenant of tenants) {
      const vorhanden = new Set(
        (await this.client.permission.findMany({ where: { tenantId: tenant.id }, select: { key: true } })).map(
          (row) => row.key,
        ),
      );
      const fehlend = PERMISSION_DEFINITIONS.filter((recht) => !vorhanden.has(recht.key));
      if (fehlend.length === 0) {
        continue;
      }
      await this.client.permission.createMany({
        data: fehlend.map((recht) => ({
          tenantId: tenant.id,
          key: recht.key,
          name: recht.name,
          description: recht.description,
        })),
      });
      this.logger.log(`${tenant.slug}: ${fehlend.length} neue Berechtigung(en) aus der Registry ergänzt`);
    }
  }

  /** Kurzer Cache: die Zuordnung ändert sich selten, wird aber pro Anfrage gebraucht. */
  private static readonly CACHE_TTL_MS = 30_000;
  private readonly cache = new Map<string, { context: TenantContext | null; expiresAt: number }>();

  /**
   * Reihenfolge der Auflösung:
   * 1. ausdrückliche Angabe (Anmeldeformular oder Header `x-tenant`)
   * 2. Subdomain bzw. eigene Domain aus dem Host
   * 3. der einzige vorhandene Mandant - für Einzelinstallationen und Entwicklung
   */
  async resolve(input: { explicit?: string; host?: string }): Promise<TenantContext | null> {
    if (input.explicit?.trim()) {
      return this.bySlug(input.explicit.trim().toLowerCase());
    }

    const fromHost = await this.byHost(input.host);
    if (fromHost) {
      return fromHost;
    }

    return this.soleTenant();
  }

  async bySlug(slug: string): Promise<TenantContext | null> {
    return this.cached(`slug:${slug}`, async () => {
      const tenant = await this.client.tenant.findFirst({
        where: { slug, isActive: true },
        select: { id: true, slug: true },
      });
      return tenant ? { tenantId: tenant.id, slug: tenant.slug } : null;
    });
  }

  async byId(id: string): Promise<TenantContext | null> {
    return this.cached(`id:${id}`, async () => {
      const tenant = await this.client.tenant.findFirst({
        where: { id, isActive: true },
        select: { id: true, slug: true },
      });
      return tenant ? { tenantId: tenant.id, slug: tenant.slug } : null;
    });
  }

  /** Erwartet `<slug>.basis.tld` oder eine als `domain` hinterlegte eigene Adresse. */
  private async byHost(host: string | undefined): Promise<TenantContext | null> {
    const hostname = host?.split(":")[0]?.toLowerCase();
    if (!hostname || hostname === "localhost" || /^\d+(\.\d+){3}$/.test(hostname)) {
      return null;
    }

    const byDomain = await this.cached(`domain:${hostname}`, async () => {
      const tenant = await this.client.tenant.findFirst({
        where: { domain: hostname, isActive: true },
        select: { id: true, slug: true },
      });
      return tenant ? { tenantId: tenant.id, slug: tenant.slug } : null;
    });
    if (byDomain) {
      return byDomain;
    }

    const parts = hostname.split(".");
    return parts.length >= 3 ? this.bySlug(parts[0]) : null;
  }

  /**
   * Genau ein Mandant: dann ist die Zuordnung eindeutig und muss niemand
   * angeben. Ab dem zweiten Mandanten ist die Angabe verpflichtend, sonst
   * landete jemand versehentlich im falschen Haus.
   */
  private async soleTenant(): Promise<TenantContext | null> {
    return this.cached("sole", async () => {
      const tenants = await this.client.tenant.findMany({
        where: { isActive: true },
        select: { id: true, slug: true },
        take: 2,
      });
      return tenants.length === 1 ? { tenantId: tenants[0].id, slug: tenants[0].slug } : null;
    });
  }

  /** Muss aufgerufen werden, wenn sich Mandanten ändern. */
  invalidate(): void {
    this.cache.clear();
  }

  private async cached(key: string, load: () => Promise<TenantContext | null>): Promise<TenantContext | null> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.context;
    }

    const context = await load();
    this.cache.set(key, { context, expiresAt: Date.now() + TenantService.CACHE_TTL_MS });
    return context;
  }

  /* ------------------------------------------------- Verwaltung */

  async list() {
    const tenants = await this.client.tenant.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });

    return tenants.map((tenant) => ({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      domain: tenant.domain,
      isActive: tenant.isActive,
      notes: tenant.notes,
      logoUrl: tenant.logoUrl,
      userCount: tenant._count.users,
      createdAt: tenant.createdAt.toISOString(),
    }));
  }

  /**
   * Legt ein Autohaus an und richtet es benutzbar ein.
   *
   * Ein leerer Mandant wäre wertlos: ohne Rollen greift keine Rechteprüfung,
   * ohne erstes Konto käme niemand hinein. Deshalb entsteht beides in derselben
   * Transaktion - entweder das Haus ist vollständig da oder gar nicht.
   */
  async create(input: {
    slug: string;
    name: string;
    domain?: string;
    notes?: string;
    adminUsername: string;
    adminPassword: string;
    adminFirstName?: string;
    adminLastName?: string;
    adminEmail?: string;
  }) {
    const slug = input.slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
      throw new BadRequestException(
        "Die Kennung darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten und muss mit einem Zeichen beginnen.",
      );
    }
    if (await this.client.tenant.findUnique({ where: { slug }, select: { id: true } })) {
      throw new BadRequestException(`Die Kennung "${slug}" ist bereits vergeben.`);
    }

    const adminUsername = input.adminUsername.trim().toLowerCase();
    if (!adminUsername) {
      throw new BadRequestException("Für das erste Administrationskonto wird ein Benutzername gebraucht.");
    }
    if (input.adminPassword.length < 10) {
      throw new BadRequestException("Das Passwort des ersten Kontos muss mindestens 10 Zeichen lang sein.");
    }

    // Außerhalb der Transaktion, weil bcrypt bewusst langsam ist und eine
    // offene Transaktion so lange eine Verbindung blockieren würde.
    const passwordHash = await bcrypt.hash(input.adminPassword, 12);

    return this.client.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name: input.name.trim(),
          domain: input.domain?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });
      const tenantId = tenant.id;

      await tx.permission.createMany({
        data: PERMISSION_DEFINITIONS.map((permission) => ({
          tenantId,
          key: permission.key,
          name: permission.name,
          description: permission.description,
        })),
      });
      const permissionByKey = new Map(
        (await tx.permission.findMany({ where: { tenantId }, select: { id: true, key: true } })).map((entry) => [
          entry.key,
          entry.id,
        ]),
      );

      for (const role of ROLE_DEFINITIONS) {
        await tx.role.create({
          data: {
            tenantId,
            key: role.key,
            name: role.name,
            description: role.description,
            rank: role.rank,
            permissions: {
              create: role.permissions.map((key) => ({ tenantId, permissionId: permissionByKey.get(key)! })),
            },
          },
        });
      }

      // Ein Standort und eine Abteilung als Startpunkt - benennen und ergänzen
      // kann sie das Haus danach selbst.
      const location = await tx.location.create({
        data: { tenantId, name: input.name.trim(), code: "HB" },
      });
      const department = await tx.department.create({ data: { tenantId, name: "Verwaltung", code: "VWL" } });
      await tx.locationDepartment.create({
        data: { tenantId, locationId: location.id, departmentId: department.id },
      });

      const adminRole = await tx.role.findFirstOrThrow({ where: { tenantId, key: "admin" } });
      await tx.user.create({
        data: {
          tenantId,
          username: adminUsername,
          email: input.adminEmail?.trim() || null,
          passwordHash,
          firstName: input.adminFirstName?.trim() || "Administration",
          lastName: input.adminLastName?.trim() || input.name.trim(),
          jobTitle: "Administration",
          locationId: location.id,
          departmentId: department.id,
          scopes: ["global", `location:${location.code}`, `department:${department.code}`],
          // Das Startpasswort kennt die Plattformverwaltung - es muss weg,
          // bevor mit dem Konto gearbeitet wird.
          mustChangePassword: true,
          roles: { create: [{ tenantId, roleId: adminRole.id }] },
        },
      });

      this.invalidate();
      return tenant;
    });
  }

  async setActive(id: string, isActive: boolean) {
    const tenant = await this.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException("Mandant nicht gefunden");
    }

    const updated = await this.client.tenant.update({ where: { id }, data: { isActive } });
    this.invalidate();
    return updated;
  }

  /** `logoUrl: null` nimmt ein Logo zurück - die Kopfzeile zeigt dann wieder die Wortmarke "AHOI". */
  async setLogo(id: string, logoUrl: string | null) {
    const tenant = await this.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException("Mandant nicht gefunden");
    }

    return this.client.tenant.update({ where: { id }, data: { logoUrl } });
  }
}
