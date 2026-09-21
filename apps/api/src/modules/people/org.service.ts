import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { resolveUserScopes } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";

export interface LocationInput {
  name: string;
  code: string;
  address?: string | null;
  /** Ids der Marken, die dieser Standort führt. Fehlt das Feld, bleibt die Zuordnung unverändert. */
  brandIds?: string[];
}

export interface BrandInput {
  name: string;
  code: string;
}

const locationWithBrands = {
  include: { locationBrands: { include: { brand: true } } },
} as const;

type LocationWithBrands = Prisma.LocationGetPayload<typeof locationWithBrands>;

/**
 * Standorte und Marken - beides Stammdaten des Hauses, kein Registry-Eintrag.
 * Marken sind Tags, die ein Standort trägt; die Zuordnung fließt über
 * `resolveUserScopes` in die Zielgruppen-Tokens der Konten an diesem Standort
 * (`brand:<code>`) und damit in die Sichtbarkeit von News und anderen
 * zielgruppengesteuerten Inhalten.
 */
@Injectable()
export class OrgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* -------------------------------------------------------- Standorte */

  async listLocations() {
    const locations = await this.prisma.location.findMany({
      ...locationWithBrands,
      orderBy: { name: "asc" },
    });
    return locations.map((location) => this.toLocationSummary(location));
  }

  async createLocation(actor: RequestUser, input: LocationInput) {
    const code = this.normalizeCode(input.code);

    const location = await this.prisma.$transaction(async (tx) => {
      const created = await tx.location.create({
        data: { name: input.name.trim(), code, address: input.address?.trim() || null },
      });
      await this.setLocationBrands(tx, created.id, input.brandIds ?? []);
      return created;
    });

    await this.audit.log({
      actor,
      action: "location.created",
      entityType: "location",
      entityId: location.id,
      detail: `Standort "${location.name}" (${location.code}) angelegt`,
    });

    return this.listLocations();
  }

  async updateLocation(actor: RequestUser, id: string, input: Partial<LocationInput>) {
    const existing = await this.prisma.location.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Standort nicht gefunden");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.location.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.code !== undefined ? { code: this.normalizeCode(input.code) } : {}),
          ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
        },
      });

      if (input.brandIds !== undefined) {
        await this.setLocationBrands(tx, id, input.brandIds);
        await this.recomputeScopesForLocation(tx, id);
      }
    });

    await this.audit.log({
      actor,
      action: "location.updated",
      entityType: "location",
      entityId: id,
      detail: `Standort "${input.name?.trim() ?? existing.name}" bearbeitet`,
    });

    return this.listLocations();
  }

  /** Standorte tragen Konten und Vorgänge - gelöscht wird erst, wenn keine Person mehr dort steht. */
  async deleteLocation(actor: RequestUser, id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!location) {
      throw new NotFoundException("Standort nicht gefunden");
    }
    if (location._count.users > 0) {
      throw new BadRequestException(
        `"${location.name}" trägt noch ${location._count.users} Konto(en). Ordnen Sie diese zuerst einem anderen Standort zu.`,
      );
    }

    await this.prisma.location.delete({ where: { id } });

    await this.audit.log({
      actor,
      action: "location.deleted",
      entityType: "location",
      entityId: id,
      detail: `Standort "${location.name}" gelöscht`,
    });

    return this.listLocations();
  }

  /* ------------------------------------------------------------ Marken */

  async listBrands() {
    return this.prisma.brand.findMany({ orderBy: { name: "asc" } });
  }

  async createBrand(actor: RequestUser, input: BrandInput) {
    const brand = await this.prisma.brand.create({
      data: { name: input.name.trim(), code: this.normalizeCode(input.code) },
    });

    await this.audit.log({
      actor,
      action: "brand.created",
      entityType: "brand",
      entityId: brand.id,
      detail: `Marke "${brand.name}" (${brand.code}) angelegt`,
    });

    return this.listBrands();
  }

  async updateBrand(actor: RequestUser, id: string, input: Partial<BrandInput>) {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Marke nicht gefunden");
    }

    await this.prisma.brand.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: this.normalizeCode(input.code) } : {}),
      },
    });

    await this.audit.log({
      actor,
      action: "brand.updated",
      entityType: "brand",
      entityId: id,
      detail: `Marke "${input.name?.trim() ?? existing.name}" bearbeitet`,
    });

    return this.listBrands();
  }

  /**
   * Löscht eine Marke. Standorte, die sie führten, verlieren die Zuordnung -
   * ihre Konten verlieren damit sofort das zugehörige `brand:<code>`-Token.
   */
  async deleteBrand(actor: RequestUser, id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { locationBrands: { select: { locationId: true } } },
    });
    if (!brand) {
      throw new NotFoundException("Marke nicht gefunden");
    }

    const betroffeneStandorte = brand.locationBrands.map((entry) => entry.locationId);

    await this.prisma.$transaction(async (tx) => {
      await tx.brand.delete({ where: { id } });
      for (const locationId of betroffeneStandorte) {
        await this.recomputeScopesForLocation(tx, locationId);
      }
    });

    await this.audit.log({
      actor,
      action: "brand.deleted",
      entityType: "brand",
      entityId: id,
      detail: `Marke "${brand.name}" gelöscht`,
    });

    return this.listBrands();
  }

  /* ---------------------------------------------------------- Helfer */

  private async setLocationBrands(tx: Prisma.TransactionClient, locationId: string, brandIds: string[]): Promise<void> {
    const unique = [...new Set(brandIds)];
    if (unique.length) {
      const gueltig = await tx.brand.count({ where: { id: { in: unique } } });
      if (gueltig !== unique.length) {
        throw new BadRequestException("Mindestens eine ausgewählte Marke existiert nicht.");
      }
    }
    await tx.locationBrand.deleteMany({ where: { locationId } });
    if (unique.length) {
      await tx.locationBrand.createMany({ data: unique.map((brandId) => ({ locationId, brandId })) });
    }
  }

  /**
   * Zielgruppen-Tokens aller Konten dieses Standorts neu ermitteln, wenn sich
   * seine Marken ändern. Entzogene wie neue `brand:<code>`-Tokens müssen sofort
   * wirken, nicht erst nach Ablauf des Tokens - deshalb enden zugleich die
   * Sitzungen der betroffenen Konten, genau wie bei einer Rechteänderung.
   */
  private async recomputeScopesForLocation(tx: Prisma.TransactionClient, locationId: string): Promise<void> {
    const users = await tx.user.findMany({
      where: { locationId },
      select: { id: true, departmentId: true, specialtyAreaId: true },
    });
    for (const user of users) {
      const scopes = await resolveUserScopes(tx, {
        locationId,
        departmentId: user.departmentId,
        specialtyAreaId: user.specialtyAreaId,
      });
      await tx.user.update({ where: { id: user.id }, data: { scopes, tokenVersion: { increment: 1 } } });
    }
  }

  private toLocationSummary(location: LocationWithBrands) {
    return {
      id: location.id,
      name: location.name,
      code: location.code,
      address: location.address,
      brands: location.locationBrands.map((entry) => ({
        id: entry.brand.id,
        name: entry.brand.name,
        code: entry.brand.code,
      })),
    };
  }

  private normalizeCode(code: string): string {
    const trimmed = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,10}$/.test(trimmed)) {
      throw new BadRequestException("Der Code muss aus 2 bis 10 Buchstaben oder Ziffern bestehen.");
    }
    return trimmed;
  }
}
