import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  EinrichtungStatusPayload,
  EinrichtungsFortschritt,
  EinrichtungsSchritt,
  EinrichtungsSchrittId,
  EinrichtungsSchrittStatus,
  EinrichtungVariante,
} from "@ah-intranet/shared";
import { EINRICHTUNG_SCHRITTE, ermittleEinrichtungsVariante } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { requireTenantId } from "../../core/tenant-context";
import { AuditService } from "../../core/audit.service";
import type { RequestUser } from "../../core/request-user";

/**
 * Ersteinrichtungs-Assistent ("Einrichtung").
 *
 * Bestandsnutzer-Strategie: die Tabelle beginnt leer, und es gibt bewusst kein
 * Migrations-Datenscript, das für jeden bestehenden Nutzer nachträglich einen
 * Datensatz anlegt - das würde bei künftigen Migrationen wiederholt geprüft
 * werden müssen, ob es schon lief. Stattdessen entscheidet dieser Dienst beim
 * ersten `GET /einrichtung/me` je Nutzer selbst anhand von `User.createdAt`
 * gegen den festen Einführungszeitpunkt der Tabelle (siehe `EINFUEHRUNG`
 * unten): wer schon vorher ein Konto hatte, bekommt sofort einen
 * abgeschlossenen Status, der Dialog erscheint nur für neu angelegte Konten.
 * Das ist idempotent (ein zweiter Aufruf ändert nichts) und lazy - kein Skript
 * muss über den gesamten Bestand laufen.
 */
@Injectable()
export class EinrichtungService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async me(user: RequestUser): Promise<EinrichtungStatusPayload> {
    return this.refresh(user);
  }

  async markWelcomeSeen(user: RequestUser): Promise<EinrichtungStatusPayload> {
    const status = await this.findOrCreate(user);
    await this.prisma.einrichtungStatus.update({
      where: { id: status.id },
      data: { willkommenGezeigt: true },
    });
    return this.refresh(user);
  }

  async skip(user: RequestUser): Promise<EinrichtungStatusPayload> {
    const status = await this.findOrCreate(user);
    await this.prisma.einrichtungStatus.update({
      where: { id: status.id },
      data: { uebersprungen: true, willkommenGezeigt: true },
    });

    await this.audit.log({
      actor: user,
      action: "einrichtung.skip",
      entityType: "einrichtung_status",
      entityId: status.id,
      detail: "Ersteinrichtung übersprungen",
    });

    return this.refresh(user);
  }

  /** Nur der eigene Status - tenant- und userId-scoped, kein weiteres Recht nötig. */
  async restart(user: RequestUser): Promise<EinrichtungStatusPayload> {
    const status = await this.findOrCreate(user);
    await this.prisma.einrichtungStatus.update({
      where: { id: status.id },
      data: {
        willkommenGezeigt: false,
        uebersprungen: false,
        abgeschlossen: false,
        abgeschlossenAm: null,
        fortschritt: {},
      },
    });

    await this.audit.log({
      actor: user,
      action: "einrichtung.restart",
      entityType: "einrichtung_status",
      entityId: status.id,
      detail: "Ersteinrichtung neu gestartet",
    });

    return this.refresh(user);
  }

  async refreshProgress(user: RequestUser): Promise<EinrichtungStatusPayload> {
    return this.refresh(user);
  }

  /**
   * Prüft serverseitig, welche Schritte durch reale Daten bereits erfüllt
   * sind, und schreibt den Fortschritt transaktionssicher fest. Läuft bei
   * jedem `GET /me` und `POST /refresh-progress` - mehrfacher Aufruf ändert
   * am Ergebnis nichts, nur der gespeicherte Stand wird nachgezogen.
   */
  private async refresh(user: RequestUser): Promise<EinrichtungStatusPayload> {
    const status = await this.findOrCreate(user);
    const variante = ermittleEinrichtungsVariante(user.permissions);
    const definierteSchritte = EINRICHTUNG_SCHRITTE[variante];

    const erfuellte = await this.pruefeSchritte(user, definierteSchritte);
    const bisher = (status.fortschritt as EinrichtungsFortschritt | null) ?? {};
    const neu: EinrichtungsFortschritt = { ...bisher };

    for (const schritt of definierteSchritte) {
      const warErledigt = bisher[schritt.id]?.done ?? false;
      const istErledigt = erfuellte.has(schritt.id);
      if (istErledigt && !warErledigt) {
        neu[schritt.id] = { done: true, completedAt: new Date().toISOString() };
      } else if (!istErledigt) {
        // Ein Schritt, der einmal durch echte Daten erfüllt war, bleibt es -
        // ein späteres Löschen des einzigen Standorts soll die Checkliste
        // nicht rückwirkend wieder aufreißen.
        neu[schritt.id] = bisher[schritt.id] ?? { done: false, completedAt: null };
      }
    }

    const pflichtErledigt = definierteSchritte
      .filter((schritt) => schritt.pflicht)
      .every((schritt) => neu[schritt.id]?.done);

    const wirdNeuAbgeschlossen = pflichtErledigt && !status.abgeschlossen;

    const aktualisiert = await this.prisma.einrichtungStatus.update({
      where: { id: status.id },
      data: {
        variante,
        fortschritt: neu as unknown as Prisma.InputJsonValue,
        ...(wirdNeuAbgeschlossen ? { abgeschlossen: true, abgeschlossenAm: new Date() } : {}),
      },
    });

    if (wirdNeuAbgeschlossen) {
      await this.audit.log({
        actor: user,
        action: "einrichtung.complete",
        entityType: "einrichtung_status",
        entityId: status.id,
        detail: `Ersteinrichtung (${variante}) abgeschlossen`,
      });
    }

    return this.toPayload(aktualisiert.variante, aktualisiert, definierteSchritte, neu);
  }

  private toPayload(
    variante: EinrichtungVariante,
    status: {
      willkommenGezeigt: boolean;
      uebersprungen: boolean;
      abgeschlossen: boolean;
      abgeschlossenAm: Date | null;
    },
    schritte: EinrichtungsSchritt[],
    fortschritt: EinrichtungsFortschritt,
  ): EinrichtungStatusPayload {
    return {
      variante,
      willkommenGezeigt: status.willkommenGezeigt,
      uebersprungen: status.uebersprungen,
      abgeschlossen: status.abgeschlossen,
      abgeschlossenAm: status.abgeschlossenAm ? status.abgeschlossenAm.toISOString() : null,
      schritte: schritte
        .slice()
        .sort((a, b) => a.reihenfolge - b.reihenfolge)
        .map((schritt) => ({
          ...schritt,
          done: fortschritt[schritt.id]?.done ?? false,
          completedAt: fortschritt[schritt.id]?.completedAt ?? null,
        })) as EinrichtungsSchrittStatus[],
    };
  }

  /**
   * Zeitpunkt, zu dem die Tabelle `EinrichtungStatus` eingeführt wurde
   * (siehe Migration `20260921115821_einrichtung_status`). Konten, die es zu
   * diesem Zeitpunkt schon gab, sind Bestandsnutzer und bekommen keinen
   * Dialog mehr - `lastLoginAt` taugt dafür nicht, weil die Anmeldung selbst
   * es bereits auf "jetzt" setzt, bevor dieser Dienst zum ersten Mal läuft.
   * `createdAt` ist der einzige Zeitstempel, der zum Zeitpunkt dieser Prüfung
   * noch den ursprünglichen Wert trägt.
   */
  private static readonly EINFUEHRUNG = new Date("2026-09-21T11:58:21.000Z");

  /** Legt bei Bedarf den Status an - Bestandsnutzer werden dabei sofort als abgeschlossen markiert. */
  private async findOrCreate(user: RequestUser) {
    const tenantId = requireTenantId();
    const existing = await this.prisma.einrichtungStatus.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (existing) {
      return existing;
    }

    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true },
    });
    const warBereitsAktiv = (account?.createdAt ?? new Date(0)) < EinrichtungService.EINFUEHRUNG;

    return this.prisma.einrichtungStatus.create({
      data: {
        userId: user.id,
        variante: ermittleEinrichtungsVariante(user.permissions),
        willkommenGezeigt: warBereitsAktiv,
        abgeschlossen: warBereitsAktiv,
        abgeschlossenAm: warBereitsAktiv ? new Date() : null,
      },
    });
  }

  /** Reale Prüfung je Schritt-ID - die einzige Stelle, die "erledigt" entscheidet. */
  private async pruefeSchritte(
    user: RequestUser,
    schritte: EinrichtungsSchritt[],
  ): Promise<Set<EinrichtungsSchrittId>> {
    const tenantId = requireTenantId();
    const ids = new Set(schritte.map((schritt) => schritt.id));
    const erfuellt = new Set<EinrichtungsSchrittId>();

    const [tenant, standorte, weitereMitarbeiter, veroeffentlichteNews, tickets, bestellungen] = await Promise.all([
      ids.has("org_profil")
        ? this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { notes: true } })
        : null,
      ids.has("standort") ? this.prisma.location.count() : Promise.resolve(0),
      ids.has("mitarbeiter") ? this.prisma.user.count({ where: { id: { not: user.id } } }) : Promise.resolve(0),
      ids.has("erste_news") || ids.has("news_hinweis")
        ? this.prisma.newsPost.count({ where: { status: "published" } })
        : Promise.resolve(0),
      ids.has("beispielprozess") ? this.prisma.ticket.count() : Promise.resolve(0),
      ids.has("beispielprozess") ? this.prisma.order.count() : Promise.resolve(0),
    ]);

    if (ids.has("org_profil") && tenant?.notes?.trim()) {
      erfuellt.add("org_profil");
    }
    if (ids.has("standort") && standorte > 0) {
      erfuellt.add("standort");
    }
    if (ids.has("mitarbeiter") && weitereMitarbeiter > 0) {
      erfuellt.add("mitarbeiter");
    }
    if (ids.has("erste_news") && veroeffentlichteNews > 0) {
      erfuellt.add("erste_news");
    }
    if (ids.has("beispielprozess") && (tickets > 0 || bestellungen > 0)) {
      erfuellt.add("beispielprozess");
    }
    // Reine Hinweis-Schritte ohne Fachdatenbezug (news_hinweis für andere
    // Varianten, freigaben_hinweis, modul_hinweis, eigene_aufgaben,
    // profil_passwort) lassen sich serverseitig nicht sinnvoll aus Daten
    // ableiten - sie bleiben unerledigt, bis eine spätere Ausbaustufe eine
    // "Seite besucht"-Markierung ergänzt. Für die standortleitung-Variante
    // zählt ein veröffentlichter News-Beitrag bereits als Hinweis erfüllt.
    if (ids.has("news_hinweis") && veroeffentlichteNews > 0) {
      erfuellt.add("news_hinweis");
    }

    return erfuellt;
  }
}
