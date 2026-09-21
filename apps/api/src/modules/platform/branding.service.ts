import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import type { RequestUser } from "../../core/request-user";
import { requireTenantId } from "../../core/tenant-context";

/** Nur Rasterbilder - SVG-Uploads könnten eingebetteten Code ausliefern. */
const ERLAUBTE_TYPEN = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

export interface LogoFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/**
 * Eigenes Logo eines Hauses - ersetzt das AHOI-Zeichen dort vollständig.
 *
 * `Tenant` ist eines der wenigen mandantenübergreifenden Modelle (siehe
 * `core/tenant-isolation.ts`) und läuft deshalb nicht automatisch durch die
 * Mandantenfilterung. Jede Schreibaktion hier filtert deshalb selbst und
 * ausschließlich auf `requireTenantId()` - nie auf eine vom Aufrufer
 * mitgegebene ID. Sonst könnte ein Haus das Logo eines anderen überschreiben.
 */
@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Öffentlich erreichbar (auch ohne Anmeldung) - die Anmeldeseite braucht es zuerst. */
  async logo(): Promise<{ data: Buffer; mime: string } | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: requireTenantId() },
      select: { logo: true, logoMime: true },
    });
    if (!tenant?.logo || !tenant.logoMime) {
      return null;
    }
    return { data: Buffer.from(tenant.logo), mime: tenant.logoMime };
  }

  async upload(actor: RequestUser, file: LogoFile | undefined) {
    if (!file) {
      throw new BadRequestException("Bitte eine Bilddatei auswählen.");
    }
    if (!ERLAUBTE_TYPEN.has(file.mimetype)) {
      throw new BadRequestException("Nur PNG, JPEG oder WebP werden unterstützt.");
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException("Die Datei darf höchstens 2 MB groß sein.");
    }

    await this.prisma.tenant.update({
      where: { id: requireTenantId() },
      data: { logo: file.buffer, logoMime: file.mimetype },
    });

    await this.audit.log({
      actor,
      action: "branding.logo.upload",
      entityType: "tenant",
      entityId: actor.tenantId,
      detail: `Eigenes Logo hinterlegt (${file.mimetype}, ${Math.round(file.size / 1024)} KB)`,
    });

    return { ok: true };
  }

  async remove(actor: RequestUser) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: requireTenantId() } });
    if (!tenant) {
      throw new NotFoundException("Mandant nicht gefunden");
    }

    await this.prisma.tenant.update({ where: { id: requireTenantId() }, data: { logo: null, logoMime: null } });

    await this.audit.log({
      actor,
      action: "branding.logo.remove",
      entityType: "tenant",
      entityId: actor.tenantId,
      detail: "Eigenes Logo entfernt - AHOI-Zeichen gilt wieder",
    });

    return { ok: true };
  }
}
