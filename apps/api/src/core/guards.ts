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
import { getModule } from "@ah-intranet/shared";
import { FEATURE_KEY, PUBLIC_KEY, ROLES_KEY } from "./decorators";
import { ModuleRegistryService } from "./module-registry.service";
import { PrismaService } from "./prisma.service";
import type { RequestUser } from "./request-user";

export const SESSION_COOKIE = "ah_session";

export interface JwtPayload {
  sub: string;
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
}

export function payloadToUser(payload: JwtPayload): RequestUser {
  return {
    id: payload.sub,
    username: payload.username,
    displayName: payload.displayName,
    role: payload.role,
    roles: payload.roles,
    permissions: payload.permissions,
    scopes: payload.scopes,
    locationId: payload.locationId,
    departmentId: payload.departmentId,
    tokenVersion: payload.tokenVersion,
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

function extractToken(request: Request): string | undefined {
  const cookieToken = (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (cookieToken) {
    return cookieToken;
  }
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

/** Wertet `@Roles(...)` aus. Die Rollen stammen aus dem Token, nicht aus dem Request-Body. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    if (!user) {
      throw new UnauthorizedException("Nicht angemeldet");
    }
    if (!required.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException("Für diese Aktion fehlen die erforderlichen Rechte");
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
