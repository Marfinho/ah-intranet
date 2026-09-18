import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import type { AppRole, EmployeeDirectoryEntry, PermissionSummary, Presence, RoleSummary } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { PRESENCE_LABELS, PRESENCE_VALUES, buildScopes, displayName, primaryRole } from "../../core/mappers";
import { isManaging, type RequestUser } from "../../core/request-user";

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
  roles: { select: { role: { select: { key: true } } } },
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
  status?: "active" | "inactive";
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
      this.prisma.user.findMany({ where, select: directorySelect, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
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
        ...(filter.status && filter.status !== "all" ? { status: filter.status as "active" | "inactive" } : {}),
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

  async createUser(actor: RequestUser, input: UserInput): Promise<{ user: EmployeeDirectoryEntry; initialPassword: string }> {
    const username = input.username.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { username }, select: { id: true } })) {
      throw new BadRequestException(`Der Benutzername "${username}" ist bereits vergeben.`);
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
        scopes,
        ...(input.roles
          ? { roles: { deleteMany: {}, create: await this.roleConnections(input.roles) } }
          : {}),
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
      data: { passwordHash: await bcrypt.hash(initialPassword, 12), mustChangePassword: true },
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
      orderBy: { rank: "desc" },
    });

    return roles.map((role) => ({
      id: role.id,
      key: role.key as AppRole,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((entry) => entry.permission.key),
      userCount: role._count.users,
    }));
  }

  async permissions(): Promise<PermissionSummary[]> {
    const permissions = await this.prisma.permission.findMany({ orderBy: { key: "asc" } });
    return permissions.map((permission) => ({
      id: permission.id,
      key: permission.key,
      name: permission.name,
      description: permission.description,
    }));
  }

  async setRolePermissions(actor: RequestUser, roleId: string, permissionKeys: string[]): Promise<RoleSummary[]> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException("Rolle nicht gefunden");
    }

    const permissions = await this.prisma.permission.findMany({ where: { key: { in: permissionKeys } } });

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
        skipDuplicates: true,
      }),
    ]);

    await this.audit.log({
      actor,
      action: "role.permissions_changed",
      entityType: "role",
      entityId: roleId,
      detail: `Rechte der Rolle "${role.name}" auf ${permissions.length} Berechtigung(en) gesetzt`,
    });

    return this.roles();
  }

  /* ---------------------------------------------------------- Helfer */

  private async roleConnections(roles: AppRole[]) {
    const unique = [...new Set(roles.length ? roles : (["mitarbeiter"] as AppRole[]))];
    const rows = await this.prisma.role.findMany({ where: { key: { in: unique } }, select: { id: true } });
    if (rows.length === 0) {
      throw new BadRequestException("Keine gültige Rolle angegeben.");
    }
    return rows.map((row) => ({ roleId: row.id }));
  }

  private async resolveScopes(input: {
    locationId?: string | null;
    departmentId?: string | null;
    specialtyAreaId?: string | null;
  }): Promise<string[]> {
    const [location, department, specialty] = await Promise.all([
      input.locationId ? this.prisma.location.findUnique({ where: { id: input.locationId }, select: { code: true } }) : null,
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
    const roles = user.roles.map((entry) => entry.role.key as AppRole);
    return {
      id: user.id,
      username: user.username,
      displayName: displayName(user),
      jobTitle: user.jobTitle,
      role: primaryRole(roles.length ? roles : ["mitarbeiter"]),
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

  /** Vorgesetzte Person, an die Abwesenheitsanträge gehen. Fällt auf Admins zurück. */
  async approversFor(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { managerId: true } });
    if (user?.managerId) {
      return [user.managerId];
    }
    const admins = await this.prisma.userRole.findMany({
      where: { role: { key: "admin" }, user: { status: "active" } },
      select: { userId: true },
    });
    return admins.map((entry) => entry.userId);
  }

  canManage(user: RequestUser): boolean {
    return isManaging(user);
  }
}
