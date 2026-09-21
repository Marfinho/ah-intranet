import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import {
  PERMISSION_DEFINITIONS,
  UNVERZICHTBARE_RECHTE,
  isPermissionKey,
  istSystemrolle,
  permissionName,
} from "@ah-intranet/shared";
import type {
  AppRole,
  EmployeeDirectoryEntry,
  PermissionSummary,
  Presence,
  RoleSummary,
  UserAccountStatus,
} from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { PRESENCE_LABELS, PRESENCE_VALUES, buildScopes, displayName, sortiereRollen } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";
import { requireTenantId } from "../../core/tenant-context";

const directorySelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  phone: true,
  mobile: true,
  email: true,
  presence: true,
  responsibilities: true,
  status: true,
  location: { select: { name: true, code: true } },
  department: { select: { name: true, code: true } },
  specialtyArea: { select: { name: true, code: true } },
  roles: { select: { role: { select: { key: true, name: true, rank: true } } } },
} as const;

export interface UserInput {
  username: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  jobTitle?: string;
  phone?: string | null;
  mobile?: string | null;
  locationId?: string | null;
  departmentId?: string | null;
  specialtyAreaId?: string | null;
  managerId?: string | null;
  roles: AppRole[];
  responsibilities?: string[];
  annualLeaveDays?: number;
  status?: UserAccountStatus;
  password?: string;
}

@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* ------------------------------------------------------ Verzeichnis */

  async directory(filter: { search?: string; location?: string; department?: string } = {}) {
    const where: Prisma.UserWhereInput = {
      status: "active",
      ...(filter.location && filter.location !== "all" ? { location: { name: filter.location } } : {}),
      ...(filter.department && filter.department !== "all" ? { department: { name: filter.department } } : {}),
      ...(filter.search
        ? {
            OR: [
              { firstName: { contains: filter.search, mode: "insensitive" } },
              { lastName: { contains: filter.search, mode: "insensitive" } },
              { jobTitle: { contains: filter.search, mode: "insensitive" } },
              { email: { contains: filter.search, mode: "insensitive" } },
              { responsibilities: { has: filter.search } },
            ],
          }
        : {}),
    };

    const [users, locations, departments] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: directorySelect,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      this.prisma.location.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      this.prisma.department.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    ]);

    return {
      items: users.map((user) => this.toDirectoryEntry(user)),
      locations: locations.map((entry) => entry.name),
      departments: departments.map((entry) => entry.name),
    };
  }

  /** Eigenes Profil pflegen - Kontaktdaten und Anwesenheit, keine Rollen. */
  async updateOwnProfile(
    user: RequestUser,
    input: { phone?: string | null; mobile?: string | null; presence?: Presence; responsibilities?: string[] },
  ): Promise<EmployeeDirectoryEntry> {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
        ...(input.presence !== undefined ? { presence: PRESENCE_VALUES[input.presence] } : {}),
        ...(input.responsibilities !== undefined ? { responsibilities: input.responsibilities } : {}),
      },
      select: directorySelect,
    });

    await this.audit.log({
      actor: user,
      action: "profile.update",
      entityType: "user",
      entityId: user.id,
      detail: "Eigenes Profil aktualisiert",
    });

    return this.toDirectoryEntry(updated);
  }

  /* --------------------------------------------------------- Benutzer */

  async listUsers(filter: { search?: string; status?: string } = {}) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(filter.status && filter.status !== "all" ? { status: filter.status as UserAccountStatus } : {}),
        ...(filter.search
          ? {
              OR: [
                { username: { contains: filter.search, mode: "insensitive" } },
                { firstName: { contains: filter.search, mode: "insensitive" } },
                { lastName: { contains: filter.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: directorySelect,
      orderBy: [{ status: "asc" }, { lastName: "asc" }],
    });
    return users.map((user) => this.toDirectoryEntry(user));
  }

  async organisation() {
    const [locations, departments, specialties] = await Promise.all([
      this.prisma.location.findMany({ orderBy: { name: "asc" } }),
      this.prisma.department.findMany({ orderBy: { name: "asc" } }),
      this.prisma.specialtyArea.findMany({ orderBy: { name: "asc" } }),
    ]);
    return { locations, departments, specialties };
  }

  async locations() {
    return this.prisma.location.findMany({ orderBy: { name: "asc" } });
  }

  /**
   * Legt einen weiteren Standort an - z. B. eine zusätzliche Filiale eines
   * Mandanten mit mehreren Häusern. Der Code ist die kurze Kennung für
   * Zielgruppen (`location:<code>`) und muss deshalb je Mandant eindeutig sein.
   */
  async createLocation(actor: RequestUser, input: { name: string; code: string; address?: string | null }) {
    const code = input.code.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException("Bitte eine Kennung für den Standort angeben.");
    }
    if (await this.prisma.location.findFirst({ where: { code }, select: { id: true } })) {
      throw new BadRequestException(`Die Kennung "${code}" ist in diesem Haus bereits vergeben.`);
    }

    const location = await this.prisma.location.create({
      data: { name: input.name.trim(), code, address: input.address?.trim() || null },
    });

    await this.audit.log({
      actor,
      action: "location.created",
      entityType: "location",
      entityId: location.id,
      detail: `Standort "${location.name}" (${location.code}) angelegt`,
    });

    return this.locations();
  }

  async updateLocation(
    actor: RequestUser,
    locationId: string,
    input: { name?: string; address?: string | null },
  ) {
    const location = await this.prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException("Standort nicht gefunden");
    }

    const updated = await this.prisma.location.update({
      where: { id: locationId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
      },
    });

    await this.audit.log({
      actor,
      action: "location.updated",
      entityType: "location",
      entityId: updated.id,
      detail: `Standort "${updated.name}" (${updated.code}) geändert`,
    });

    return this.locations();
  }

  /**
   * Weist ein erreichtes Lizenzkontingent ab, bevor ein weiteres aktives
   * Konto entsteht. `licensedSeats: null` heißt unbegrenzt - nicht jedes Haus
   * hat ein Lizenzmodell, ein erfundenes Limit wäre schlimmer als keins.
   */
  private async pruefeLizenzkontingent(): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: requireTenantId() },
      select: { licensedSeats: true },
    });
    if (tenant.licensedSeats === null) {
      return;
    }

    const aktiveKonten = await this.prisma.user.count({ where: { status: "active" } });
    if (aktiveKonten >= tenant.licensedSeats) {
      throw new BadRequestException(
        `Das Lizenzkontingent ist erreicht (${tenant.licensedSeats} aktive Konten). ` +
          "Bitte ein Konto deaktivieren oder das Kontingent erweitern lassen.",
      );
    }
  }

  async createUser(
    actor: RequestUser,
    input: UserInput,
  ): Promise<{ user: EmployeeDirectoryEntry; initialPassword: string }> {
    const username = input.username.trim().toLowerCase();
    if (await this.prisma.user.findFirst({ where: { username }, select: { id: true } })) {
      throw new BadRequestException(`Der Benutzername "${username}" ist bereits vergeben.`);
    }
    if ((input.status ?? "active") === "active") {
      await this.pruefeLizenzkontingent();
    }

    const initialPassword = input.password ?? this.generatePassword();
    const scopes = await this.resolveScopes(input);

    const created = await this.prisma.user.create({
      data: {
        username,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || null,
        jobTitle: input.jobTitle ?? "Mitarbeitende:r",
        phone: input.phone ?? null,
        mobile: input.mobile ?? null,
        locationId: input.locationId || null,
        departmentId: input.departmentId || null,
        specialtyAreaId: input.specialtyAreaId || null,
        managerId: input.managerId || null,
        responsibilities: input.responsibilities ?? [],
        annualLeaveDays: input.annualLeaveDays ?? 30,
        status: input.status ?? "active",
        scopes,
        passwordHash: await bcrypt.hash(initialPassword, 12),
        mustChangePassword: true,
        roles: { create: await this.roleConnections(input.roles) },
      },
      select: directorySelect,
    });

    await this.audit.log({
      actor,
      action: "user.create",
      entityType: "user",
      entityId: created.id,
      detail: `Benutzer ${created.username} angelegt (${input.roles.join(", ")})`,
    });

    return { user: this.toDirectoryEntry(created), initialPassword };
  }

  async updateUser(actor: RequestUser, id: string, input: Partial<UserInput>): Promise<EmployeeDirectoryEntry> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Benutzer nicht gefunden");
    }
    if (input.status === "active" && existing.status !== "active") {
      await this.pruefeLizenzkontingent();
    }

    const scopes = await this.resolveScopes({
      locationId: input.locationId !== undefined ? input.locationId : existing.locationId,
      departmentId: input.departmentId !== undefined ? input.departmentId : existing.departmentId,
      specialtyAreaId: input.specialtyAreaId !== undefined ? input.specialtyAreaId : existing.specialtyAreaId,
    });

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
        ...(input.locationId !== undefined ? { locationId: input.locationId || null } : {}),
        ...(input.departmentId !== undefined ? { departmentId: input.departmentId || null } : {}),
        ...(input.specialtyAreaId !== undefined ? { specialtyAreaId: input.specialtyAreaId || null } : {}),
        ...(input.managerId !== undefined ? { managerId: input.managerId || null } : {}),
        ...(input.responsibilities !== undefined ? { responsibilities: input.responsibilities } : {}),
        ...(input.annualLeaveDays !== undefined ? { annualLeaveDays: input.annualLeaveDays } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        // Sperre und Rollenwechsel müssen sofort greifen, nicht erst nach
        // Ablauf des Tokens - deshalb werden laufende Sitzungen verworfen.
        ...(input.status !== undefined || input.roles !== undefined ? { tokenVersion: { increment: 1 } } : {}),
        scopes,
        ...(input.roles ? { roles: { deleteMany: {}, create: await this.roleConnections(input.roles) } } : {}),
      },
      select: directorySelect,
    });

    await this.audit.log({
      actor,
      action: "user.update",
      entityType: "user",
      entityId: id,
      detail: `Benutzer ${updated.username} bearbeitet`,
    });

    return this.toDirectoryEntry(updated);
  }

  async resetPassword(actor: RequestUser, id: string): Promise<{ initialPassword: string }> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { username: true } });
    if (!user) {
      throw new NotFoundException("Benutzer nicht gefunden");
    }

    const initialPassword = this.generatePassword();
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(initialPassword, 12),
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 },
      },
    });

    await this.audit.log({
      actor,
      action: "user.password_reset",
      entityType: "user",
      entityId: id,
      detail: `Passwort für ${user.username} zurückgesetzt`,
    });

    return { initialPassword };
  }

  /* ----------------------------------------------------------- Rollen */

  async roles(): Promise<RoleSummary[]> {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
      orderBy: [{ rank: "desc" }, { name: "asc" }],
    });

    return roles.map((role) => ({
      id: role.id,
      key: role.key as AppRole,
      name: role.name,
      description: role.description,
      rank: role.rank,
      permissions: role.permissions.map((entry) => entry.permission.key),
      userCount: role._count.users,
      isSystem: istSystemrolle(role.key),
    }));
  }

  async permissions(): Promise<PermissionSummary[]> {
    const permissions = await this.prisma.permission.findMany();
    // Reihenfolge und Bereich kommen aus der Registry, nicht aus der Datenbank:
    // dort steht die fachliche Gliederung, die Tabelle kennt nur Zeilen.
    return PERMISSION_DEFINITIONS.flatMap((definition) => {
      const row = permissions.find((entry) => entry.key === definition.key);
      return row
        ? [
            {
              id: row.id,
              key: definition.key,
              name: definition.name,
              description: definition.description,
              bereich: definition.bereich,
            },
          ]
        : [];
    });
  }

  /**
   * Legt eine eigene Rolle an.
   *
   * Der Schlüssel wird aus dem Namen abgeleitet und ist danach fest - er steht
   * im Audit-Log und in Verweisen. Umbenennen ändert nur den Anzeigenamen.
   */
  async createRole(
    actor: RequestUser,
    input: { name: string; description: string; rank?: number; permissions: string[] },
  ): Promise<RoleSummary[]> {
    const key = await this.freierRollenschluessel(input.name);
    const permissions = await this.gueltigeRechte(input.permissions);

    const role = await this.prisma.role.create({
      data: {
        key,
        name: input.name.trim(),
        description: input.description.trim(),
        rank: this.gueltigerRang(input.rank),
        permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
      },
    });

    await this.audit.log({
      actor,
      action: "role.created",
      entityType: "role",
      entityId: role.id,
      detail: `Rolle "${role.name}" angelegt mit ${permissions.length} Recht(en)`,
      metadata: { schluessel: key, rechte: permissions.map((permission) => permission.key) },
    });

    return this.roles();
  }

  /** Ändert Name, Beschreibung, Rangfolge und Rechte einer Rolle. */
  async updateRole(
    actor: RequestUser,
    roleId: string,
    input: { name?: string; description?: string; rank?: number; permissions?: string[] },
  ): Promise<RoleSummary[]> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException("Rolle nicht gefunden");
    }

    const permissions = input.permissions ? await this.gueltigeRechte(input.permissions) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          ...(input.rank !== undefined ? { rank: this.gueltigerRang(input.rank) } : {}),
        },
      });

      if (permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
          skipDuplicates: true,
        });
        await this.beendeSitzungen(tx, roleId);
      }

      await this.assertVerwaltungErreichbar(tx);
    });

    await this.audit.log({
      actor,
      action: "role.updated",
      entityType: "role",
      entityId: roleId,
      detail: `Rolle "${input.name?.trim() ?? role.name}" geändert`,
      metadata: permissions ? { rechte: permissions.map((permission) => permission.key) } : {},
    });

    return this.roles();
  }

  /**
   * Löscht eine eigene Rolle.
   *
   * Rollen der Grundausstattung bleiben: Seed und Einrichtung neuer Häuser
   * setzen auf ihnen auf. Eine Rolle mit Konten wird nicht gelöscht, sondern
   * erst geleert - sonst verlören Menschen still ihre Rechte.
   */
  async deleteRole(actor: RequestUser, roleId: string): Promise<RoleSummary[]> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true } } },
    });
    if (!role) {
      throw new NotFoundException("Rolle nicht gefunden");
    }
    if (istSystemrolle(role.key)) {
      throw new BadRequestException(
        `"${role.name}" gehört zur Grundausstattung und lässt sich nicht löschen. Ihre Rechte können Sie ändern.`,
      );
    }
    if (role._count.users > 0) {
      throw new BadRequestException(
        `"${role.name}" ist noch ${role._count.users} Konto(en) zugewiesen. Nehmen Sie die Rolle dort zuerst weg.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id: roleId } });
      await this.assertVerwaltungErreichbar(tx);
    });

    await this.audit.log({
      actor,
      action: "role.deleted",
      entityType: "role",
      entityId: roleId,
      detail: `Rolle "${role.name}" gelöscht`,
    });

    return this.roles();
  }

  async setRolePermissions(actor: RequestUser, roleId: string, permissionKeys: string[]): Promise<RoleSummary[]> {
    return this.updateRole(actor, roleId, { permissions: permissionKeys });
  }

  /**
   * Verhindert, dass ein Haus sich selbst aussperrt.
   *
   * `roles.manage` und `users.manage` sind unverzichtbar: Ohne das erste kommt
   * niemand mehr an den Rechte-Editor, ohne das zweite entsteht kein neues
   * Konto mit Verwaltungsrechten. Beides ist nicht rückgängig zu machen.
   *
   * Geprüft wird **nach** der Änderung, innerhalb derselben Transaktion: der
   * tatsächliche Zustand statt einer nachgebauten Vorhersage. Ein Wurf rollt
   * die Änderung zurück. Entscheidend ist nicht, ob irgendeine Rolle das Recht
   * trägt, sondern ob ein **aktives Konto** es über eine ihrer Rollen hat -
   * ein Recht in einer leeren Rolle rettet niemanden.
   */
  private async assertVerwaltungErreichbar(tx: Prisma.TransactionClient): Promise<void> {
    for (const recht of UNVERZICHTBARE_RECHTE) {
      const traeger = await tx.userRole.count({
        where: { role: { permissions: { some: { permission: { key: recht } } } }, user: { status: "active" } },
      });
      if (traeger === 0) {
        throw new BadRequestException(
          `Nach dieser Änderung hätte niemand mehr das Recht "${permissionName(recht)}". ` +
            "Das Haus könnte seine Verwaltung nicht mehr erreichen und die Entscheidung nicht zurücknehmen.",
        );
      }
    }
  }

  /**
   * Beendet die Sitzungen aller Konten einer Rolle.
   *
   * Wessen Rechte sich ändern, muss es sofort merken - nicht erst, wenn das
   * Token in bis zu zwölf Stunden abläuft. Ein entzogenes Recht, das noch einen
   * halben Tag wirkt, ist kein entzogenes Recht.
   */
  private async beendeSitzungen(tx: Prisma.TransactionClient, roleId: string): Promise<number> {
    const betroffene = await tx.userRole.findMany({ where: { roleId }, select: { userId: true } });
    if (betroffene.length === 0) {
      return 0;
    }
    await tx.user.updateMany({
      where: { id: { in: betroffene.map((eintrag) => eintrag.userId) } },
      data: { tokenVersion: { increment: 1 } },
    });
    return betroffene.length;
  }

  /** Rechte aus der Registry nachschlagen; unbekannte Schlüssel fliegen auf. */
  private async gueltigeRechte(keys: string[]): Promise<{ id: string; key: string }[]> {
    const unbekannt = keys.filter((key) => !isPermissionKey(key));
    if (unbekannt.length > 0) {
      throw new BadRequestException(`Unbekannte Berechtigung: ${unbekannt.join(", ")}`);
    }
    return this.prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
  }

  private gueltigerRang(rank?: number): number {
    if (rank === undefined) {
      return 0;
    }
    if (!Number.isInteger(rank) || rank < 0 || rank > 99) {
      throw new BadRequestException("Die Rangfolge muss zwischen 0 und 99 liegen.");
    }
    return rank;
  }

  /** Schlüssel aus dem Namen, bei Kollision mit Zähler dahinter. */
  private async freierRollenschluessel(name: string): Promise<string> {
    const basis =
      name
        .trim()
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "rolle";

    const belegt = new Set((await this.prisma.role.findMany({ select: { key: true } })).map((row) => row.key));
    if (!belegt.has(basis) && !istSystemrolle(basis)) {
      return basis;
    }
    for (let i = 2; i < 100; i += 1) {
      const kandidat = `${basis}-${i}`;
      if (!belegt.has(kandidat)) {
        return kandidat;
      }
    }
    throw new BadRequestException("Für diesen Namen ist kein freier Rollenschlüssel mehr zu finden.");
  }

  /* ---------------------------------------------------------- Helfer */

  /**
   * Rollen des Hauses nachschlagen.
   *
   * Unbekannte Schlüssel werden benannt und nicht stillschweigend verworfen -
   * sonst bekäme ein Konto weniger Rollen als angefordert, ohne dass es auffällt.
   */
  private async roleConnections(roles: AppRole[]) {
    const unique = [...new Set(roles.length ? roles : ["mitarbeiter"])];
    const rows = await this.prisma.role.findMany({ where: { key: { in: unique } }, select: { id: true, key: true } });
    const unbekannt = unique.filter((key) => !rows.some((row) => row.key === key));
    if (unbekannt.length > 0) {
      throw new BadRequestException(`Unbekannte Rolle: ${unbekannt.join(", ")}`);
    }
    return rows.map((row) => ({ roleId: row.id }));
  }

  private async resolveScopes(input: {
    locationId?: string | null;
    departmentId?: string | null;
    specialtyAreaId?: string | null;
  }): Promise<string[]> {
    const [location, department, specialty] = await Promise.all([
      input.locationId
        ? this.prisma.location.findUnique({ where: { id: input.locationId }, select: { code: true } })
        : null,
      input.departmentId
        ? this.prisma.department.findUnique({ where: { id: input.departmentId }, select: { code: true } })
        : null,
      input.specialtyAreaId
        ? this.prisma.specialtyArea.findUnique({ where: { id: input.specialtyAreaId }, select: { code: true } })
        : null,
    ]);

    return buildScopes({
      locationCode: location?.code,
      departmentCode: department?.code,
      specialtyCode: specialty?.code,
    });
  }

  private generatePassword(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const bytes = Array.from({ length: 14 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
    return `${bytes.join("")}!`;
  }

  private toDirectoryEntry(user: Prisma.UserGetPayload<{ select: typeof directorySelect }>): EmployeeDirectoryEntry {
    const rollen = sortiereRollen(user.roles.map((entry) => entry.role));
    return {
      id: user.id,
      username: user.username,
      displayName: displayName(user),
      jobTitle: user.jobTitle,
      role: rollen[0]?.name ?? "Mitarbeitende",
      roleKeys: rollen.map((rolle) => rolle.key),
      location: user.location?.name ?? null,
      department: user.department?.name ?? null,
      specialtyArea: user.specialtyArea?.name ?? null,
      phone: user.phone,
      mobile: user.mobile,
      email: user.email,
      responsibilities: user.responsibilities,
      presence: PRESENCE_LABELS[user.presence] ?? "vor Ort",
      status: user.status,
    };
  }

  /**
   * Vorgesetzte Person, an die Abwesenheitsanträge gehen.
   *
   * Ohne Vorgesetzte fällt der Antrag an alle, die das Haus zur Freigabe
   * berechtigt hat. Bewusst über das Recht und nicht über einen Rollenschlüssel:
   * ein Haus kann die Freigabe einer eigenen Rolle geben, die "admin" nicht heißt.
   */
  async approversFor(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { managerId: true } });
    if (user?.managerId) {
      return [user.managerId];
    }
    return this.usersWithPermission("absences.approve");
  }

  /** Aktive Konten, deren Rollen das genannte Recht tragen. */
  async usersWithPermission(permission: string): Promise<string[]> {
    const traeger = await this.prisma.userRole.findMany({
      where: { role: { permissions: { some: { permission: { key: permission } } } }, user: { status: "active" } },
      select: { userId: true },
    });
    return [...new Set(traeger.map((entry) => entry.userId))];
  }
}
