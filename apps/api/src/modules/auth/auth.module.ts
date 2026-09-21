import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

/**
 * Werte, die in Beispieldateien dieses Projekts stehen. Wer sie produktiv
 * übernimmt, signiert seine Sitzungen mit einem Schlüssel, der im Repository
 * nachzulesen ist - jede Sitzung wäre fälschbar, inklusive `isPlatformAdmin`.
 */
const BEKANNTE_BEISPIELWERTE = new Set([
  "bitte-aendern-langer-zufallswert",
  "ci-schluessel-ohne-bedeutung",
  "changeme",
  "secret",
]);

/** Kürzer als das macht das Raten des Schlüssels zu einer Rechenaufgabe. */
const MINDESTLAENGE = 32;

/**
 * Lässt die API mit einem untauglichen Sitzungsschlüssel nicht starten.
 *
 * Ein Startabbruch ist unbequem und genau deshalb richtig: Der Beispielwert aus
 * `docker-compose.yml` ist der Weg, auf dem eine Installation sonst produktiv
 * geht, ohne dass es jemandem auffällt. Ausgenommen bleibt die Entwicklung -
 * dort soll ein kurzer Wert weiter genügen.
 */
export function pruefeSitzungsschluessel(secret: string, umgebung = process.env.NODE_ENV): void {
  if (BEKANNTE_BEISPIELWERTE.has(secret.trim().toLowerCase())) {
    throw new Error(
      "JWT_SECRET steht noch auf dem Beispielwert aus dem Repository. " +
        "Mit ihm ließe sich jede Sitzung fälschen. Bitte einen eigenen Zufallswert setzen " +
        "(z. B. `openssl rand -base64 48`).",
    );
  }
  if (umgebung === "production" && secret.length < MINDESTLAENGE) {
    throw new Error(
      `JWT_SECRET ist mit ${secret.length} Zeichen zu kurz - im Produktivbetrieb sind mindestens ${MINDESTLAENGE} verlangt.`,
    );
  }
}

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");
        if (!secret) {
          throw new Error("JWT_SECRET ist nicht gesetzt - die API startet ohne Sitzungsschlüssel nicht.");
        }
        pruefeSitzungsschluessel(secret);
        return {
          secret,
          signOptions: { expiresIn: config.get<string>("JWT_EXPIRES_IN") ?? "12h" },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
