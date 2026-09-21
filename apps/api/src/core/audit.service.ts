import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { RequestUser } from "./request-user";

export interface AuditInput {
  actor: RequestUser | { id?: string | null; username: string };
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

/** Zeitfenster, über das fehlgeschlagene Einträge gezählt werden. */
const FENSTER_MS = 60 * 60 * 1000;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /** Zeitpunkte fehlgeschlagener Einträge der letzten Stunde. */
  private readonly ausfaelle: number[] = [];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Schreibt einen Audit-Eintrag. Bewusst ohne `await` im Aufrufpfad nutzbar:
   * ein fehlgeschlagenes Protokoll darf die Fachaktion nie scheitern lassen.
   *
   * Die Kehrseite davon ist, dass eine fachliche Aktion ohne Eintrag durchgehen
   * kann. Damit das nicht **still** geschieht, hinterlässt jeder Fehlschlag eine
   * auswertbare Zeile auf der Standardfehlerausgabe und wird gezählt; der
   * Healthcheck gibt die Zahl der letzten Stunde aus. Ein Protokoll, dessen
   * Lücken niemand bemerkt, taugt nicht als Nachweis.
   */
  async log(input: AuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actor.id ?? null,
          actorUsername: input.actor.username,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          detail: input.detail,
          metadataJson: (input.metadata ?? undefined) as never,
        },
      });
    } catch (error) {
      this.vermerkeAusfall(input, error as Error);
    }
  }

  /** Fehlgeschlagene Einträge der letzten Stunde. */
  ausfaelleImFenster(now: number = Date.now()): number {
    this.verwerfeAlte(now);
    return this.ausfaelle.length;
  }

  private vermerkeAusfall(input: AuditInput, error: Error): void {
    const jetzt = Date.now();
    this.verwerfeAlte(jetzt);
    this.ausfaelle.push(jetzt);

    this.logger.error(`Audit-Eintrag ${input.action} konnte nicht geschrieben werden`, error);

    // Dasselbe Format wie das Anfrageprotokoll, damit die Einsammelstelle der
    // Umgebung darauf alarmieren kann, ohne eine zweite Regel zu brauchen.
    // Der Inhalt des Eintrags gehört hier nicht hinein - er enthält
    // Personendaten, und dies ist keine zweite Datenhaltung.
    process.stderr.write(
      JSON.stringify({
        zeit: new Date(jetzt).toISOString(),
        art: "audit-ausfall",
        aktion: input.action,
        objektart: input.entityType,
        grund: error.message,
        ausfaelleLetzteStunde: this.ausfaelle.length,
      }) + "\n",
    );
  }

  private verwerfeAlte(now: number): void {
    const grenze = now - FENSTER_MS;
    while (this.ausfaelle.length > 0 && this.ausfaelle[0] < grenze) {
      this.ausfaelle.shift();
    }
  }
}
