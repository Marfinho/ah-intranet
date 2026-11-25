import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
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
  OrganigrammKnoten,
  PermissionSummary,
  Presence,
  RoleSummary,
  UserAccountStatus,
} from "@ah-intranet/shared";
import { PrismaService, type TransaktionsClient } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { PRESENCE_LABELS, PRESENCE_VALUES, displayName, resolveUserScopes, sortiereRollen } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";
import { requireTenantId } from "../../core/tenant-context";
import { baueBaum, vorgesetztenKette, wuerdeKreisBilden, type OrgKnoten } from "./organigramm";
import { ganztaegigAbwesend } from "./schluesselregeln";

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
  loginEnabled: true,
  location: { select: { name: true, code: true } },
  department: { select: { name: true, code: true } },
  specialtyArea: { select: { name: true, code: true } },
  roles: { select: { role: { select: { key: true, name: true, rank: true } } } },
} as const;

export interface UserInput {
  /** Bei Personen ohne Zugang optional - dann wird eine interne Kennung erzeugt. */
  username?: string;
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
  /** Aus = Person ohne Anmeldung (z. B. Werkstatt ohne Rechner). Standard: an. */
  zugang?: boolean;
}

/** Wird aufgerufen, wenn ein Konto nicht mehr handlungsfähig ist; liefert einen Hinweis für die ausführende Person. */
export type KontoAusfallHandler = (ereignis: {
  userId: string;
  actor: RequestUser;
  anlass: string;
}) => Promise<string | null>;

@Injectable()
export class PeopleService {
  /**
   * Beobachter statt direktem Aufruf: die Schlüsselfunktionen brauchen den
   * Personaldienst, und der soll sie nicht kennen müssen - sonst bildeten beide
   * einen Kreis. Wer wissen will, wenn ein Konto ausfällt, trägt sich hier ein.
   */
  private readonly ausfallHandler: KontoAusfallHandler[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  registriereKontoAusfall(handler: KontoAusfallHandler): void {
    this.ausfallHandler.push(handler);
  }

  private async meldeKontoAusfall(userId: string, actor: RequestUser, anlass: string): Promise<string | null> {
    const hinweise: string[] = [];
    for (const handler of this.ausfallHandler) {
      const hinweis = await handler({ userId, actor, anlass });
      if (hinweis) {
        hinweise.push(hinweis);
      }
    }
    return hinweise.length > 0 ? hinweise.join("\n\n") : null;
  }

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

  /**
   * Organigramm des Hauses: aktive Personen als Baum nach Vorgesetzten.
   *
   * Aktiv heißt `status`, nicht Zugang: Personen ohne Anmeldung gehören
   * hinein, sonst fehlte gerade die Werkstatt, die der Baum abbilden soll.
   */
  async organigramm(): Promise<OrganigrammKnoten[]> {
    const personen = await this.prisma.user.findMany({
      where: { status: "active" },
      select: { ...directorySelect, managerId: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    const nachId = new Map(personen.map((person) => [person.id, this.toDirectoryEntry(person)]));
    const zuKnoten = (knoten: OrgKnoten<(typeof personen)[number]>): OrganigrammKnoten => ({
      ...nachId.get(knoten.person.id)!,
      unterstellte: knoten.unterstellte.map(zuKnoten),
    });
    return baueBaum(personen).map(zuKnoten);
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
    const [locations, departments, specialties, brands] = await Promise.all([
      this.prisma.location.findMany({ orderBy: { name: "asc" } }),
      this.prisma.department.findMany({ orderBy: { name: "asc" } }),
      this.prisma.specialtyArea.findMany({ orderBy: { name: "asc" } }),
      this.prisma.brand.findMany({ orderBy: { name: "asc" } }),
    ]);
    return { locations, departments, specialties, brands };
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

    // Nur Konten mit Zugang: Personen ohne Anmeldung belegen keinen Platz.
    const aktiveKonten = await this.prisma.user.count({ where: { status: "active", loginEnabled: true } });
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
  ): Promise<{ user: EmployeeDirectoryEntry; initialPassword: string | null }> {
    const mitZugang = input.zugang !== false;
    const username = input.username?.trim().toLowerCase() || (mitZugang ? "" : await this.interneKennung(input));
    if (!username) {
      throw new BadRequestException("Bitte einen Benutzernamen angeben.");
    }
    if (await this.prisma.user.findFirst({ where: { username }, select: { id: true } })) {
      throw new BadRequestException(`Der Benutzername "${username}" ist bereits vergeben.`);
    }
    if (mitZugang && (input.status ?? "active") === "active") {
      await this.pruefeLizenzkontingent();
    }

    const initialPassword = mitZugang ? (input.password ?? this.generatePassword()) : null;
    const scopes = await resolveUserScopes(this.prisma, input);

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
        passwordHash: initialPassword ? await bcrypt.hash(initialPassword, 12) : null,
        loginEnabled: mitZugang,
        mustChangePassword: mitZugang,
        roles: { create: await this.roleConnections(input.roles) },
      },
      select: directorySelect,
    });

    await this.audit.log({
      actor,
      action: "user.create",
      entityType: "user",
      entityId: created.id,
      detail: `${mitZugang ? "Benutzer" : "Person ohne Zugang"} ${created.username} angelegt (${input.roles.join(", ")})`,
    });

    return { user: this.toDirectoryEntry(created), initialPassword };
  }

  async updateUser(actor: RequestUser, id: string, input: Partial<UserInput>): Promise<EmployeeDirectoryEntry> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Benutzer nicht gefunden");
    }
    if (input.status === "active" && existing.status !== "active" && existing.loginEnabled) {
      await this.pruefeLizenzkontingent();
    }
    if (input.managerId) {
      await this.pruefeVorgesetzte(id, input.managerId);
    }

    const scopes = await resolveUserScopes(this.prisma, {
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

    // Erst nach dem Speichern: die Prüfung der Besetzung liest den neuen Stand.
    const deaktiviert = input.status === "inactive" && existing.status === "active";
    const hinweis = deaktiviert ? await this.meldeKontoAusfall(id, actor, "wurde deaktiviert") : null;
    return { ...this.toDirectoryEntry(updated), ...(hinweis ? { hinweis } : {}) };
  }

  async resetPassword(actor: RequestUser, id: string): Promise<{ initialPassword: string }> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { username: true, loginEnabled: true } });
    if (!user) {
      throw new NotFoundException("Benutzer nicht gefunden");
    }
    if (!user.loginEnabled) {
      throw new BadRequestException("Diese Person hat keinen Zugang. Richten Sie zuerst einen Zugang ein.");
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

  /**
   * Gibt einer Person ohne Zugang ein Konto. Das Kontingent wird geprüft wie bei
   * jeder Neuanlage - sonst wäre das der Weg an der Lizenz vorbei.
   */
  async zugangEinrichten(actor: RequestUser, id: string): Promise<{ initialPassword: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { username: true, loginEnabled: true, status: true },
    });
    if (!user) {
      throw new NotFoundException("Benutzer nicht gefunden");
    }
    if (user.loginEnabled) {
      throw new BadRequestException("Diese Person hat bereits einen Zugang.");
    }
    if (user.status === "deleted") {
      throw new BadRequestException("Ein anonymisiertes Konto lässt sich nicht wieder einrichten.");
    }
    await this.pruefeLizenzkontingent();

    const initialPassword = this.generatePassword();
    await this.prisma.user.update({
      where: { id },
      data: {
        loginEnabled: true,
        passwordHash: await bcrypt.hash(initialPassword, 12),
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    await this.audit.log({
      actor,
      action: "user.access_granted",
      entityType: "user",
      entityId: id,
      detail: `Zugang für ${user.username} eingerichtet`,
    });
    return { initialPassword };
  }

  /**
   * Nimmt den Zugang, behält aber die Person. Laufende Sitzungen enden sofort;
   * Abwesenheiten, Schichten und Organigramm bleiben unberührt.
   */
  async zugangEntziehen(actor: RequestUser, id: string): Promise<EmployeeDirectoryEntry> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { username: true, loginEnabled: true } });
    if (!user) {
      throw new NotFoundException("Benutzer nicht gefunden");
    }
    if (id === actor.id) {
      throw new BadRequestException("Sie können sich den eigenen Zugang nicht entziehen.");
    }

    const aktualisiert = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: { loginEnabled: false, passwordHash: null, mustChangePassword: false, tokenVersion: { increment: 1 } },
        select: directorySelect,
      });
      await this.assertVerwaltungErreichbar(tx);
      return row;
    });

    await this.audit.log({
      actor,
      action: "user.access_revoked",
      entityType: "user",
      entityId: id,
      detail: `Zugang von ${user.username} entzogen`,
    });
    const hinweis = user.loginEnabled ? await this.meldeKontoAusfall(id, actor, "hat keinen Zugang mehr") : null;
    return { ...this.toDirectoryEntry(aktualisiert), ...(hinweis ? { hinweis } : {}) };
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
  private async assertVerwaltungErreichbar(tx: TransaktionsClient): Promise<void> {
    for (const recht of UNVERZICHTBARE_RECHTE) {
      const traeger = await tx.userRole.count({
        where: {
          role: { permissions: { some: { permission: { key: recht } } } },
          user: { status: "active", loginEnabled: true },
        },
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
  private async beendeSitzungen(tx: TransaktionsClient, roleId: string): Promise<number> {
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

  /** Kennung für Personen, die sich nie anmelden: `vorname.nachname`, bei Kollision mit Zähler. */
  private async interneKennung(input: Pick<UserInput, "firstName" | "lastName">): Promise<string> {
    const teil = (text: string) =>
      text
        .trim()
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "");
    const basis = `${teil(input.firstName)}.${teil(input.lastName)}`.replace(/^\.|\.$/g, "") || "person";
    const belegt = new Set(
      (await this.prisma.user.findMany({ where: { username: { startsWith: basis } }, select: { username: true } })).map(
        (row) => row.username,
      ),
    );
    if (!belegt.has(basis)) {
      return basis;
    }
    for (let i = 2; i < 1000; i += 1) {
      if (!belegt.has(`${basis}${i}`)) {
        return `${basis}${i}`;
      }
    }
    throw new BadRequestException("Es ist keine freie Kennung mehr zu finden.");
  }

  /**
   * Verhindert Zyklen im Organigramm: wer (mittelbar) selbst unter der Person
   * steht, kann nicht deren Vorgesetzte werden. Ein Kreis machte jede
   * Aufwärtssuche zur Endlosschleife.
   */
  async pruefeVorgesetzte(personId: string, vorgesetzteId: string): Promise<void> {
    const personen = await this.prisma.user.findMany({ select: { id: true, managerId: true } });
    if (!personen.some((person) => person.id === vorgesetzteId)) {
      throw new BadRequestException("Die gewählte Vorgesetzte existiert nicht.");
    }
    if (wuerdeKreisBilden(personen, personId, vorgesetzteId)) {
      throw new BadRequestException(
        personId === vorgesetzteId
          ? "Eine Person kann nicht ihre eigene Vorgesetzte sein."
          : "Das würde einen Kreis im Organigramm ergeben.",
      );
    }
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
      hasAccess: user.loginEnabled,
    };
  }

  /**
   * Wer einen Abwesenheitsantrag entscheidet.
   *
   * Die nächste Führungskraft in der Kette, die freigeben darf und heute da
   * ist: ist die Vorgesetzte selbst abwesend, geht der Antrag an deren
   * Vorgesetzte - bis hinauf zur Geschäftsführung. Ohne Kette fällt er an alle
   * Anwesenden mit Freigaberecht, notfalls an alle. Bewusst über das Recht und
   * nicht über einen Rollenschlüssel: ein Haus kann die Freigabe einer eigenen
   * Rolle geben, die "admin" nicht heißt.
   */
  async approversFor(userId: string): Promise<string[]> {
    const [personen, abwesend, freigeber] = await Promise.all([
      this.prisma.user.findMany({ select: { id: true, managerId: true } }),
      this.abwesendeAm(new Date()),
      this.usersWithPermission("absences.approve"),
    ]);

    const berechtigt = new Set(freigeber);
    const erste = vorgesetztenKette(personen, userId).find((id) => berechtigt.has(id) && !abwesend.has(id));
    if (erste) {
      return [erste];
    }

    const anwesende = freigeber.filter((id) => id !== userId && !abwesend.has(id));
    return anwesende.length > 0 ? anwesende : freigeber;
  }

  /** Konten, die an dem Tag ganztägig abwesend (genehmigt) sind. Halbe Ränder zählen als anwesend. */
  async abwesendeAm(datum: Date): Promise<Set<string>> {
    const tag = new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
    const folgetag = new Date(tag.getTime() + 86_400_000);
    const rows = await this.prisma.absence.findMany({
      where: { status: "approved", startDate: { lt: folgetag }, endDate: { gte: tag } },
      select: { userId: true, startDate: true, endDate: true, startHalb: true, endHalb: true },
    });
    return new Set(
      rows
        .filter((row) =>
          ganztaegigAbwesend(
            { von: row.startDate, bis: row.endDate, startHalb: row.startHalb, endHalb: row.endHalb },
            tag,
          ),
        )
        .map((row) => row.userId),
    );
  }

  /** Aktive Konten, deren Rollen das genannte Recht tragen. */
  async usersWithPermission(permission: string): Promise<string[]> {
    const traeger = await this.prisma.userRole.findMany({
      where: {
        role: { permissions: { some: { permission: { key: permission } } } },
        user: { status: "active", loginEnabled: true },
      },
      select: { userId: true },
    });
    return [...new Set(traeger.map((entry) => entry.userId))];
  }
}
