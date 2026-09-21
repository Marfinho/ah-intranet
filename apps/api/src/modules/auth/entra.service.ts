import { randomBytes } from "node:crypto";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { SessionUser } from "@ah-intranet/shared";
import { getAuthProvider } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { TenantService } from "../../core/tenant.service";
import { runWithTenant } from "../../core/tenant-context";
import { entschluessele, istVerschluesselungMoeglich, verschluessele } from "../../core/geheimnis";
import { buildAuthorizeUrl, decodeIdTokenClaims, exchangeCodeForTokens } from "../../core/microsoft-identity";
import { AuthService, userWithContext } from "./auth.service";

/** Fester Rückgabepfad - muss Zeichen für Zeichen in der App-Registrierung hinterlegt sein. */
export function entraRedirectUri(): string {
  const basis = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}/api`;
  return `${basis.replace(/\/$/, "")}/auth/entra/callback`;
}

/**
 * Anmeldung über Microsoft Entra ID.
 *
 * Verknüpft wird über die vorhandene E-Mail-Adresse im Haus - beim ersten Mal.
 * Danach entscheidet nur noch die Objekt-ID des Entra-Kontos, damit eine
 * spätere Änderung der E-Mail-Adresse nicht aus Versehen die Zuordnung
 * verschiebt. Es entsteht dabei nie ein neues Konto: ohne passenden
 * Datensatz im Haus lehnt die Anmeldung ab, mit klarer Begründung.
 */
@Injectable()
export class EntraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantService,
    private readonly audit: AuditService,
    private readonly authService: AuthService,
  ) {}

  /**
   * `state` trägt die Hauskennung und einen Zufallswert in einem: der
   * Aufrufer legt denselben Wert als Cookie ab und vergleicht ihn beim
   * Rücksprung mit dem, was Microsoft zurückgibt - das schützt vor
   * eingeschleusten Rücksprüngen (CSRF), ohne einen serverseitigen Speicher
   * für offene Anmeldevorgänge zu brauchen.
   */
  async startLogin(tenantSlug: string): Promise<{ url: string; state: string }> {
    const tenant = await this.tenants.bySlug(tenantSlug);
    if (!tenant) {
      throw new BadRequestException("Unbekanntes Haus.");
    }

    return runWithTenant(tenant, async () => {
      const provider = await this.prisma.tenantAuthProvider.findFirst({ where: { kind: "entra", isActive: true } });
      if (!provider || !provider.clientSecret) {
        throw new BadRequestException("Für dieses Haus ist die Anmeldung mit Microsoft nicht eingerichtet.");
      }

      const state = `${tenantSlug}.${randomBytes(24).toString("hex")}`;
      const url = buildAuthorizeUrl({
        directory: provider.directory,
        clientId: provider.clientId,
        redirectUri: entraRedirectUri(),
        state,
      });
      return { url, state };
    });
  }

  async handleCallback(tenantSlug: string, code: string): Promise<{ token: string; user: SessionUser }> {
    const definition = getAuthProvider("entra");
    if (!definition?.inBetrieb) {
      throw new BadRequestException("Die Anmeldung mit Microsoft ist in dieser Fassung nicht in Betrieb.");
    }

    const tenant = await this.tenants.bySlug(tenantSlug);
    if (!tenant) {
      throw new BadRequestException("Unbekanntes Haus.");
    }

    return runWithTenant(tenant, async () => {
      const provider = await this.prisma.tenantAuthProvider.findFirst({ where: { kind: "entra", isActive: true } });
      if (!provider || !provider.clientSecret) {
        throw new BadRequestException("Für dieses Haus ist die Anmeldung mit Microsoft nicht eingerichtet.");
      }

      const tokens = await exchangeCodeForTokens({
        directory: provider.directory,
        clientId: provider.clientId,
        clientSecret: entschluessele(provider.clientSecret),
        code,
        redirectUri: entraRedirectUri(),
      });

      const claims = decodeIdTokenClaims(tokens.idToken, provider.clientId, provider.directory);

      let user = await this.prisma.user.findFirst({
        where: { entraObjectId: claims.oid },
        include: userWithContext,
      });

      if (!user) {
        if (!claims.email) {
          throw new UnauthorizedException(
            "Das Microsoft-Konto nennt keine E-Mail-Adresse - eine Zuordnung zu einem AHOI-Konto ist so nicht möglich.",
          );
        }
        const kandidat = await this.prisma.user.findFirst({
          where: { email: { equals: claims.email, mode: "insensitive" } },
          include: userWithContext,
        });
        if (!kandidat) {
          throw new UnauthorizedException(
            `Für das Microsoft-Konto "${claims.email}" ist im Haus kein passendes AHOI-Konto hinterlegt. ` +
              "Bitte die Administration bitten, ein Konto mit dieser E-Mail-Adresse anzulegen oder zu ergänzen.",
          );
        }
        await this.prisma.user.update({ where: { id: kandidat.id }, data: { entraObjectId: claims.oid } });
        user = { ...kandidat, entraObjectId: claims.oid } as typeof kandidat;

        await this.audit.log({
          actor: { id: kandidat.id, username: kandidat.username },
          action: "auth.entra_linked",
          entityType: "user",
          entityId: kandidat.id,
          detail: `Microsoft-Konto "${claims.email}" mit diesem AHOI-Konto verknüpft`,
        });
      }

      if (user.status !== "active") {
        throw new UnauthorizedException("Dieses Konto ist deaktiviert.");
      }

      // Ohne Refresh-Token (Anbieter hat `offline_access` nicht gewährt) bleibt
      // der bisherige Wert unangetastet, statt den Kalenderzugriff kommentarlos
      // zu entziehen.
      if (tokens.refreshToken && istVerschluesselungMoeglich()) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { msRefreshToken: verschluessele(tokens.refreshToken), msTokenUpdatedAt: new Date() },
        });
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      });

      const result = await this.authService.issueSession(user);

      await this.audit.log({
        actor: { id: user.id, username: user.username },
        action: "auth.login",
        entityType: "user",
        entityId: user.id,
        detail: `Anmeldung über Microsoft Entra ID erfolgreich für ${result.user.displayName}`,
      });

      return result;
    });
  }
}
