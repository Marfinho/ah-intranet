import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { SessionUser } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { MfaService } from "./mfa.service";
import { currentTenant } from "../../core/tenant-context";
import { AuditService } from "../../core/audit.service";
import { buildScopes, displayName, scopeLabel, sortiereRollen } from "../../core/mappers";
import type { JwtPayload } from "../../core/guards";
import type { RequestUser } from "../../core/request-user";

const userWithContext = {
  tenant: { select: { slug: true, name: true, mfaPflicht: true } },
  location: {
    select: { name: true, code: true, locationBrands: { select: { brand: { select: { code: true } } } } },
  },
  department: { select: { name: true, code: true } },
  specialtyArea: { select: { name: true, code: true } },
  roles: {
    select: {
      role: {
        select: {
          key: true,
          name: true,
          rank: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  },
} as const;

/** Ergebnis des Passwortschritts: Sitzung oder die Aufforderung, den zweiten Faktor zu liefern. */
export type LoginErgebnis = { token: string; user: SessionUser } | { mfaErforderlich: true; mfaToken: string };

interface ZwischenToken {
  sub: string;
  tenantId: string;
}

function zwischenSchluessel(): string {
  return `${process.env.JWT_SECRET ?? ""}:mfa`;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
  ) {}

  /** Nach so vielen Fehlversuchen wird das Konto vorübergehend gesperrt. */
  private static readonly MAX_FAILED_LOGINS = 5;
  private static readonly LOCK_MINUTES = 15;

  /**
   * Prüft die Zugangsdaten gegen den in der Datenbank gespeicherten bcrypt-Hash.
   * Existiert der Benutzer nicht, wird trotzdem ein Vergleich gegen einen
   * Dummy-Hash ausgeführt, damit die Antwortzeit keine Benutzernamen verrät.
   *
   * Fehlversuche werden gezählt; nach `MAX_FAILED_LOGINS` ist das Konto für
   * `LOCK_MINUTES` gesperrt. Das begrenzt Rateversuche auch dann, wenn jemand
   * die IP-Drosselung über viele Adressen umgeht.
   */
  async validate(username: string, password: string) {
    // Ohne Mandanten ist nicht entscheidbar, welches Konto gemeint ist -
    // derselbe Benutzername kann in mehreren Häusern existieren.
    if (!currentTenant()) {
      throw new UnauthorizedException(
        "Kein Autohaus zugeordnet. Bitte die Kennung angeben oder die Adresse des Hauses verwenden.",
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { username: username.trim().toLowerCase() },
      include: userWithContext,
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const minuten = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Das Konto ist nach mehreren Fehlversuchen für ${minuten} Minute(n) gesperrt.`);
    }

    const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
    const matches = await bcrypt.compare(password, hash);

    if (!user || !matches) {
      if (user) {
        await this.registerFailedAttempt(user.id, user.failedLoginCount);
      }
      throw new UnauthorizedException("Ungültige Zugangsdaten");
    }
    if (user.status !== "active") {
      throw new UnauthorizedException("Dieses Konto ist deaktiviert");
    }
    // Ohne Passwort kam es schon oben nicht bis hierher; die Prüfung bleibt
    // trotzdem, damit ein später gesetzter Hash keine Sperre umgeht.
    if (!user.loginEnabled) {
      throw new UnauthorizedException("Ungültige Zugangsdaten");
    }
    return user;
  }

  /**
   * Erster Schritt der Anmeldung: das Passwort.
   *
   * Hat das Konto einen zweiten Faktor, entsteht noch keine Sitzung, sondern ein
   * kurzlebiges Zwischentoken, das nur `anmeldenMitFaktor` einlöst. Fehlversuche
   * werden hier noch nicht zurückgesetzt: wer das Passwort kennt, soll die
   * Codes nicht unbegrenzt raten können.
   */
  async login(username: string, password: string): Promise<LoginErgebnis> {
    const user = await this.validate(username, password);

    if (user.totpEnabledAt) {
      return { mfaErforderlich: true, mfaToken: await this.zwischentoken(user.id) };
    }
    return this.sitzung(user);
  }

  /** Zweiter Schritt: Zwischentoken plus Code (oder Wiederherstellungscode). */
  async anmeldenMitFaktor(mfaToken: string, code: string): Promise<{ token: string; user: SessionUser }> {
    let zwischen: ZwischenToken;
    try {
      zwischen = await this.jwt.verifyAsync<ZwischenToken>(mfaToken, {
        secret: zwischenSchluessel(),
        algorithms: ["HS256"],
      });
    } catch {
      throw new UnauthorizedException("Die Anmeldung ist abgelaufen. Bitte Benutzername und Passwort erneut eingeben.");
    }
    // Das Token gehört zu einem Haus; ein anderer Host darf es nicht einlösen.
    if (currentTenant()?.tenantId !== zwischen.tenantId) {
      throw new UnauthorizedException("Die Anmeldung ist abgelaufen. Bitte Benutzername und Passwort erneut eingeben.");
    }

    const user = await this.prisma.user.findUnique({ where: { id: zwischen.sub }, include: userWithContext });
    if (!user || user.status !== "active" || !user.totpEnabledAt) {
      throw new UnauthorizedException("Die Anmeldung ist nicht möglich.");
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minuten = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Das Konto ist nach mehreren Fehlversuchen für ${minuten} Minute(n) gesperrt.`);
    }

    if (!(await this.mfa.pruefe(user, code))) {
      await this.registerFailedAttempt(user.id, user.failedLoginCount);
      throw new UnauthorizedException("Der Code ist ungültig.");
    }
    const ergebnis = await this.sitzung(user);
    return ergebnis;
  }

  /** Frische Sitzung für ein Konto, etwa direkt nach dem Einrichten des Faktors. */
  async sitzungFuer(userId: string): Promise<{ token: string; user: SessionUser }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userWithContext });
    return this.sitzung(user);
  }

  private async zwischentoken(userId: string): Promise<string> {
    const tenant = currentTenant();
    return this.jwt.signAsync(
      { sub: userId, tenantId: tenant?.tenantId },
      // Anderer Schlüssel als die Sitzung: ein Zwischentoken lässt sich so nie
      // als Sitzung vorlegen, selbst wenn die Prüfung dort einmal Lücken hätte.
      { secret: zwischenSchluessel(), algorithm: "HS256", expiresIn: "5m" },
    );
  }

  private async sitzung(
    user: Awaited<ReturnType<AuthService["validate"]>>,
  ): Promise<{ token: string; user: SessionUser }> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });

    const session = this.toSessionUser(user);
    const payload: JwtPayload = {
      sub: session.id,
      tenantId: user.tenantId,
      username: session.username,
      displayName: session.displayName,
      role: session.role,
      roles: session.roles,
      permissions: session.permissions,
      scopes: session.scopes,
      locationId: user.locationId,
      departmentId: user.departmentId,
      tokenVersion: user.tokenVersion,
      isPlatformAdmin: user.isPlatformAdmin,
    };

    await this.audit.log({
      actor: { id: user.id, username: user.username },
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      detail: `Anmeldung erfolgreich für ${session.displayName}${user.totpEnabledAt ? " (mit zweitem Faktor)" : ""}`,
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
    if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException("Das aktuelle Passwort ist nicht korrekt.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        mustChangePassword: false,
        // Alle anderen Sitzungen verlieren damit sofort ihre Gültigkeit.
        tokenVersion: { increment: 1 },
      },
    });

    await this.audit.log({
      actor: current,
      action: "auth.password_changed",
      entityType: "user",
      entityId: user.id,
      detail: "Passwort geändert",
    });
  }

  /** Zählt einen Fehlversuch und sperrt das Konto beim Erreichen der Grenze. */
  private async registerFailedAttempt(userId: string, current: number): Promise<void> {
    const next = current + 1;
    const gesperrt = next >= AuthService.MAX_FAILED_LOGINS;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: gesperrt ? 0 : next,
        lockedUntil: gesperrt ? new Date(Date.now() + AuthService.LOCK_MINUTES * 60_000) : null,
      },
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
    isPlatformAdmin: boolean;
    totpEnabledAt: Date | null;
    tenant: { slug: string; name: string; mfaPflicht: boolean };
    location: { name: string; code: string; locationBrands: { brand: { code: string } }[] } | null;
    department: { name: string; code: string } | null;
    specialtyArea: { name: string; code: string } | null;
    roles: { role: { key: string; name: string; rank: number; permissions: { permission: { key: string } }[] } }[];
  }): SessionUser {
    const sortiert = sortiereRollen(user.roles.map((entry) => entry.role));
    // Plattformkonten brauchen den Faktor immer, Häuser können ihn für alle verlangen.
    const pflicht = user.isPlatformAdmin || user.tenant.mfaPflicht;
    const effectiveRoles = sortiert.length ? sortiert : [{ key: "mitarbeiter", name: "Mitarbeitende", rank: 0 }];
    const permissions = [
      ...new Set(user.roles.flatMap((entry) => entry.role.permissions.map((rp) => rp.permission.key))),
    ];

    return {
      id: user.id,
      username: user.username,
      displayName: displayName(user),
      email: user.email,
      role: effectiveRoles[0].key,
      roles: effectiveRoles.map((rolle) => rolle.key),
      roleLabels: effectiveRoles.map((rolle) => rolle.name),
      jobTitle: user.jobTitle,
      location: user.location?.name ?? null,
      department: user.department?.name ?? null,
      specialtyArea: user.specialtyArea?.name ?? null,
      scopeLabel: scopeLabel(user),
      scopes: buildScopes({
        locationCode: user.location?.code,
        departmentCode: user.department?.code,
        specialtyCode: user.specialtyArea?.code,
        brandCodes: user.location?.locationBrands.map((entry) => entry.brand.code),
      }),
      permissions,
      mustChangePassword: user.mustChangePassword,
      tenant: { slug: user.tenant.slug, name: user.tenant.name },
      isPlatformAdmin: user.isPlatformAdmin,
      mfa: {
        aktiv: user.totpEnabledAt !== null,
        pflicht,
        einrichtungOffen: pflicht && user.totpEnabledAt === null,
      },
    };
  }
}
