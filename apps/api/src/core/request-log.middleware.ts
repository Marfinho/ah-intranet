import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { currentTenant } from "./tenant-context";
import type { RequestUser } from "./request-user";

/**
 * Eine auswertbare Zeile je Anfrage.
 *
 * Ohne sie erfährt man von einem Fehler, wenn jemand anruft. Mit ihr lässt sich
 * fragen: Welches Haus? Welche Route? Wie lange? Wie oft?
 *
 * Bewusst JSON auf die Standardausgabe und keine Datei: die Anwendung läuft im
 * Container, das Einsammeln ist Sache der Umgebung. Ein Format, das jedes
 * Werkzeug liest, ist hier mehr wert als eigene Logik.
 *
 * **Was nicht hineingehört:** Anfragedaten, Kopfzeilen, Adressen. Ein Protokoll
 * mit Urlaubsanträgen darin wäre eine zweite, unkontrollierte Personendatenhaltung.
 * Die Benutzerkennung steht drin, weil ohne sie kein Vorfall aufzuklären ist -
 * sie unterliegt derselben Frist wie das Audit-Log.
 */
@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    response.on("finish", () => {
      const dauerMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const benutzer = (request as Request & { user?: RequestUser }).user;

      // Der Healthcheck läuft im Minutentakt und sagt nichts - er würde das
      // Protokoll fluten und die interessanten Zeilen verdecken.
      if (request.originalUrl.startsWith("/api/health") && response.statusCode < 400) {
        return;
      }

      process.stdout.write(
        JSON.stringify({
          zeit: new Date().toISOString(),
          art: "anfrage",
          methode: request.method,
          pfad: request.route?.path ?? request.originalUrl.split("?")[0],
          status: response.statusCode,
          dauerMs: Math.round(dauerMs),
          mandant: currentTenant()?.slug ?? null,
          benutzer: benutzer?.username ?? null,
        }) + "\n",
      );
    });

    next();
  }
}
