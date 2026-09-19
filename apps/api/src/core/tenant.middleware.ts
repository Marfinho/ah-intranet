import { Injectable, NestMiddleware } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { NextFunction, Request, Response } from "express";
import { extractToken, type JwtPayload } from "./guards";
import { TenantService } from "./tenant.service";
import { runWithTenant } from "./tenant-context";

/**
 * Setzt den Mandantenkontext für die gesamte Anfrage.
 *
 * Läuft vor den Guards, damit auch deren Datenbankzugriffe bereits gefiltert
 * sind. Das Token wird hier eigenständig geprüft: ein ungeprüftes Token dürfte
 * nicht bestimmen, auf welchen Datenbestand zugegriffen wird.
 *
 * Ist kein Mandant zu ermitteln, läuft die Anfrage ohne Kontext weiter - jeder
 * Datenzugriff scheitert dann bewusst in `PrismaService`. Ausgenommen sind
 * damit nur Routen, die gar keine Daten brauchen (Healthcheck).
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenants: TenantService,
    private readonly jwt: JwtService,
  ) {}

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    const context = await this.resolve(request);

    if (!context) {
      next();
      return;
    }

    // Für das Frontend nachvollziehbar machen, in welchem Haus es gelandet ist.
    response.setHeader("x-tenant", context.slug);
    runWithTenant(context, () => next());
  }

  private async resolve(request: Request) {
    // 1. Angemeldete Anfragen bringen den Mandanten im geprüften Token mit -
    //    aus dem Cookie oder der Bearer-Kopfzeile, genau wie beim Guard.
    const token = extractToken(request);
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(token);
        if (payload.tenantId) {
          const fromToken = await this.tenants.byId(payload.tenantId);
          if (fromToken) {
            return fromToken;
          }
        }
      } catch {
        // Abgelaufen oder ungültig: der Guard lehnt gleich ab, hier fällt die
        // Auflösung auf Host und ausdrückliche Angabe zurück.
      }
    }

    // 2. Anmeldung und öffentliche Aufrufe: Angabe im Formular, Header oder Host.
    const body = request.body as { tenant?: unknown } | undefined;
    const explicit =
      (typeof body?.tenant === "string" ? body.tenant : undefined) ??
      (typeof request.headers["x-tenant"] === "string" ? (request.headers["x-tenant"] as string) : undefined);

    return this.tenants.resolve({ explicit, host: request.headers.host });
  }
}
