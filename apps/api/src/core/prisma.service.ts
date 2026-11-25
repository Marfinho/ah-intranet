import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { neuerClient } from "./datenbank";
import { mandantenTrennung } from "./mandanten-erweiterung";
import { currentTenant, hasNoContext, isUnscoped } from "./tenant-context";

const logger = new Logger("PrismaService");

/**
 * Der Datenbank-Client der Anwendung: der Prisma-Client mit der Mandantentrennung.
 *
 * Das ist die eigentliche Sicherheitsgrenze: Fachcode muss `tenantId` nirgends
 * mitführen, und ein vergessener Filter in einem Service kann keine fremden
 * Daten preisgeben. Umgekehrt schlägt jede Abfrage ohne gesetzten
 * Mandantenkontext fehl, statt stillschweigend über alle Häuser zu laufen.
 *
 * Grenze der Methode: `$queryRaw` und `$executeRaw` haben kein Modell und laufen
 * deshalb ungefiltert. Rohabfragen müssen den Mandanten selbst in die Bedingung
 * aufnehmen - in dieser Anwendung gibt es bisher nur das `SELECT 1` des
 * Healthchecks.
 *
 * Seit Prisma 7 als Client-Erweiterung (`$extends`) umgesetzt; die frühere
 * Middleware gibt es dort nicht mehr. Eine Erweiterung liefert einen neuen Client
 * statt den bestehenden zu verändern. Damit die Klasse als Einspritzmarke
 * erhalten bleibt und jeder Aufruf im Fachcode unverändert bleibt, gibt der
 * Konstruktor den erweiterten Client zurück.
 */
function baueClient() {
  return neuerClient().$extends(
    mandantenTrennung((modell, operation) => {
      if (isUnscoped()) {
        return "durchlassen";
      }
      const mandant = currentTenant();
      if (!mandant) {
        // Lieber ein harter Fehler als eine Abfrage über alle Mandanten.
        const grund = hasNoContext() ? "kein Mandantenkontext gesetzt" : "Mandant unbekannt";
        logger.error(`Zugriff auf ${modell}.${operation} abgelehnt: ${grund}`);
        throw new Error(
          `Zugriff auf ${modell} ohne Mandantenkontext. Aufrufe außerhalb einer Anfrage müssen runWithTenant oder runUnscoped verwenden.`,
        );
      }
      return { mandant: mandant.tenantId };
    }),
  );
}

export type DatenbankClient = ReturnType<typeof baueClient>;

/**
 * Was eine Hilfsfunktion braucht, die sowohl mit dem Client als auch innerhalb
 * einer Transaktion laufen soll. `Prisma.TransactionClient` passt nicht mehr:
 * der erweiterte Client hat einen eigenen Typ.
 */
export type TransaktionsClient = Omit<
  DatenbankClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

// Deklarationszusammenführung: die Klasse trägt alle Methoden und Modelle des Clients.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface PrismaService extends DatenbankClient {}

@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class PrismaService {
  constructor() {
    return baueClient() as unknown as PrismaService;
  }
}

/**
 * Verbindet beim Start und trennt beim Beenden.
 *
 * Eigene Klasse, weil der Konstruktor von `PrismaService` den Client selbst
 * zurückgibt - eine Lebenszyklus-Methode an der Klasse käme bei Nest nicht an.
 */
@Injectable()
export class PrismaLebenszyklus implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
