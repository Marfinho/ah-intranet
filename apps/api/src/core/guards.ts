import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { AppRole } from "@ah-intranet/shared";
import { getModule, permissionName, sichereCookiesAktiv, sitzungsCookieName } from "@ah-intranet/shared";
import { FEATURE_KEY, PERMISSION_KEY, PLATFORM_ADMIN_KEY, PUBLIC_KEY } from "./decorators";
import { ModuleRegistryService } from "./module-registry.service";
import { PrismaService } from "./prisma.service";
import type { RequestUser } from "./request-user";

/**
 * Der Name hängt an der Umgebung (siehe `sitzungsCookieName`), deshalb einmal
 * beim Start ausgewertet und nicht bei jedem Zugriff.
 */
export const SICHERE_COOKIES = sichereCookiesAktiv(process.env);
export const SESSION_COOKIE = sitzungsCookieName(SICHERE_COOKIES);

export interface JwtPayload {
  sub: string;
  /** Mandant, zu dem diese Sitzung gehört. */
  tenantId: string;
  username: string;
  displayName: string;
  role: AppRole;
  roles: AppRole[];
  permissions: string[];
  scopes: string[];
  locationId: string | null;
  departmentId: string | null;
  /** Muss mit dem Wert am Benutzer übereinstimmen, sonst ist die Sitzung ungültig. */
  tokenVersion: number;
  isPlatformAdmin?: boolean;
}

export function payloadToUser(payload: JwtPayload): RequestUser {
  return {
    id: payload.sub,
    tenantId: payload.tenantId,
    username: payload.username,
    displayName: payload.displayName,
    role: payload.role,
    roles: payload.roles,
    permissions: payload.permissions,
    scopes: payload.scopes,
    locationId: payload.locationId,
    departmentId: payload.departmentId,
    tokenVersion: payload.tokenVersion,
    isPlatformAdmin: payload.isPlatformAdmin ?? false,
  };
}

/**
 * Prüft das Session-JWT. Das Token kommt bevorzugt aus dem httpOnly-Cookie,
 * alternativ aus einem Bearer-Header, damit die API auch skriptbar bleibt.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractToken(request);
    if (!token) {
      throw new UnauthorizedException("Nicht angemeldet");
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Sitzung abgelaufen oder ungültig");
    }

    // Ein gültig signiertes Token genügt nicht: Sperre, Rollenentzug und
    // Passwortwechsel müssen sofort wirken, nicht erst nach Ablauf der Laufzeit.
    const account = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, tokenVersion: true },
    });

    if (!account || account.status !== "active") {
      throw new UnauthorizedException("Das Konto ist nicht mehr aktiv.");
    }
    if (account.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException("Die Sitzung wurde beendet. Bitte melden Sie sich erneut an.");
    }

    (request as Request & { user: RequestUser }).user = payloadToUser(payload);
    return true;
  }
}

/**
 * Sitzungstoken aus Cookie oder Bearer-Kopfzeile.
 *
 * Wird auch von der Mandanten-Middleware gebraucht: Läse die nur das Cookie,
 * käme eine Anfrage mit Bearer-Token ohne Mandantenkontext bei den Guards an
 * und scheiterte, obwohl das Token gültig ist.
 */
export function extractToken(request: Request): string | undefined {
  const cookieToken = (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (cookieToken) {
    return cookieToken;
  }
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

/**
 * Wertet `@Permission(...)` und `@PlatformAdmin()` aus.
 *
 * Die Rechte stammen aus dem Token, nicht aus den Anfragedaten. Sie stehen dort
 * aufgelöst - welche Rolle sie trägt, ist zur Prüfzeit ohne Belang.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const platformOnly = this.reflector.getAllAndOverride<boolean>(PLATFORM_ADMIN_KEY, targets);
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, targets);

    if (!platformOnly && !permission) {
      return true;
    }

    const user = context.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    if (!user) {
      throw new UnauthorizedException("Nicht angemeldet");
    }
    if (platformOnly && !user.isPlatformAdmin) {
      throw new ForbiddenException("Diese Aktion ist der Plattformverwaltung vorbehalten");
    }
    if (permission && !user.permissions.includes(permission)) {
      throw new ForbiddenException(`Für diese Aktion fehlt die Berechtigung "${permissionName(permission)}".`);
    }
    return true;
  }
}

/**
 * Sperrt Routen deaktivierter Module. Bewusst 404 statt 403: ein abgeschaltetes
 * Modul soll sich nach außen verhalten, als gäbe es die Funktion nicht.
 */
@Injectable()
export class ModuleEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modules: ModuleRegistryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [context.getHandler(), context.getClass()]);
    if (!moduleKey) {
      return true;
    }

    if (await this.modules.isEnabled(moduleKey)) {
      return true;
    }

    throw new NotFoundException(`Das Modul "${getModule(moduleKey)?.label ?? moduleKey}" ist derzeit deaktiviert.`);
  }
}
