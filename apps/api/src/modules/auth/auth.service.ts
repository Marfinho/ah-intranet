import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { AppRole, SessionUser } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { buildScopes, displayName, primaryRole, scopeLabel } from "../../core/mappers";
import type { JwtPayload } from "../../core/guards";
import type { RequestUser } from "../../core/request-user";

const userWithContext = {
  location: { select: { name: true, code: true } },
  department: { select: { name: true, code: true } },
  specialtyArea: { select: { name: true, code: true } },
  roles: { select: { role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } } } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Prüft die Zugangsdaten gegen den in der Datenbank gespeicherten bcrypt-Hash.
   * Existiert der Benutzer nicht, wird trotzdem ein Vergleich gegen einen
   * Dummy-Hash ausgeführt, damit die Antwortzeit keine Benutzernamen verrät.
   */
  async validate(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      include: userWithContext,
    });

    const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
    const matches = await bcrypt.compare(password, hash);

    if (!user || !matches) {
      throw new UnauthorizedException("Ungültige Zugangsdaten");
    }
    if (user.status !== "active") {
      throw new UnauthorizedException("Dieses Konto ist deaktiviert");
    }
    return user;
  }

  async login(username: string, password: string): Promise<{ token: string; user: SessionUser }> {
    const user = await this.validate(username, password);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const session = this.toSessionUser(user);
    const payload: JwtPayload = {
      sub: session.id,
      username: session.username,
      displayName: session.displayName,
      role: session.role,
      roles: session.roles,
      permissions: session.permissions,
      scopes: session.scopes,
      locationId: user.locationId,
      departmentId: user.departmentId,
    };

    await this.audit.log({
      actor: { id: user.id, username: user.username },
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      detail: `Anmeldung erfolgreich für ${session.displayName}`,
    });

    return { token: await this.jwt.signAsync(payload), user: session };
  }

  /** Frisch aus der DB gelesenes Profil - Rollenänderungen wirken so ohne Neuanmeldung. */
  async me(current: RequestUser): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { id: current.id }, include: userWithContext });
    if (!user || user.status !== "active") {
      throw new UnauthorizedException("Konto nicht mehr verfügbar");
    }
    return this.toSessionUser(user);
  }

  async changePassword(current: RequestUser, currentPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < 10) {
      throw new BadRequestException("Das neue Passwort muss mindestens 10 Zeichen lang sein.");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: current.id } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException("Das aktuelle Passwort ist nicht korrekt.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: false },
    });

    await this.audit.log({
      actor: current,
      action: "auth.password_changed",
      entityType: "user",
      entityId: user.id,
      detail: "Passwort geändert",
    });
  }

  async logout(current: RequestUser): Promise<void> {
    await this.audit.log({
      actor: current,
      action: "auth.logout",
      entityType: "user",
      entityId: current.id,
      detail: "Abmeldung",
    });
  }

  private toSessionUser(user: {
    id: string;
    username: string;
    email: string | null;
    firstName: string;
    lastName: string;
    jobTitle: string;
    mustChangePassword: boolean;
    location: { name: string; code: string } | null;
    department: { name: string; code: string } | null;
    specialtyArea: { name: string; code: string } | null;
    roles: { role: { key: string; permissions: { permission: { key: string } }[] } }[];
  }): SessionUser {
    const roles = (user.roles.map((entry) => entry.role.key) as AppRole[]).filter(Boolean);
    const effectiveRoles = roles.length ? roles : (["mitarbeiter"] as AppRole[]);
    const permissions = [
      ...new Set(user.roles.flatMap((entry) => entry.role.permissions.map((rp) => rp.permission.key))),
    ];

    return {
      id: user.id,
      username: user.username,
      displayName: displayName(user),
      email: user.email,
      role: primaryRole(effectiveRoles),
      roles: effectiveRoles,
      jobTitle: user.jobTitle,
      location: user.location?.name ?? null,
      department: user.department?.name ?? null,
      specialtyArea: user.specialtyArea?.name ?? null,
      scopeLabel: scopeLabel(user),
      scopes: buildScopes({
        locationCode: user.location?.code,
        departmentCode: user.department?.code,
        specialtyCode: user.specialtyArea?.code,
      }),
      permissions,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
