import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  RETENTION_RULES,
  type RetentionRule,
  anonymizableRules,
  cutoffDate,
  deletableRules,
} from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { displayName } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";
import { FREITEXT_STELLEN, anonymisierteFelder } from "./anonymisierung";

/** Benutzername im Protokoll, wenn der Lauf per Cron kommt und niemand ihn auslöst. */
export const SYSTEM_AKTEUR = "system";

/**
 * Ab wann ein ausgebliebener Lauf als Fehler gilt.
 *
 * Der Lauf gehört nachts in den Cron. Zwei ausgefallene Nächte sind kein
 * Zufall mehr - und solange niemand es merkt, greift **keine einzige** Frist.
 * Das ist der wunde Punkt einer Anwendung, deren zentrale Zusage die
 * Durchsetzung von Fristen ist.
 */
export const LAUF_UEBERFAELLIG_STUNDEN = 48;

export interface LaufStatus {
  /** Zeitpunkt des letzten protokollierten Laufs, oder `null`. */
  zuletzt: string | null;
  stundenHer: number | null;
  ueberfaellig: boolean;
  ausgeloestVon: string | null;
  hinweis: string;
}

export interface AufraeumErgebnis {
  key: string;
  label: string;
  days: number;
  cutoff: string;
  /** Betroffene Datensätze - gelöscht oder, je nach `behandlung`, anonymisiert. */
  entfernt: number;
  /** Fehlt bei den gelöschten Datenarten; dort ist "gelöscht" der Normalfall. */
  behandlung?: "anonymisiert";
}

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* ------------------------------------------------------------ Auskunft */

  /**
   * Auskunft nach Art. 15 DSGVO: alles, was das Intranet zu einer Person hält.
   *
   * Bewusst vollständig und maschinenlesbar statt hübsch aufbereitet - die
   * Auskunft muss belegen, dass nichts fehlt. Was das Intranet *nicht* leisten
   * kann (Freitexte anderer Personen), steht als Hinweis mit drin, statt
   * stillschweigend zu fehlen.
   */
  async auskunft(actor: RequestUser, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        location: { select: { name: true, code: true } },
        department: { select: { name: true, code: true } },
        specialtyArea: { select: { name: true, code: true } },
        roles: { select: { role: { select: { key: true, name: true } } } },
      },
    });
    if (!user) {
      throw new NotFoundException("Person nicht gefunden");
    }

    const [
      orders,
      absences,
      tickets,
      ticketComments,
      roomBookings,
      notifications,
      auditLogs,
      shifts,
      shiftSwaps,
      custody,
      mealOrders,
      newsReads,
      newsComments,
      orderComments,
      approvalDecisions,
      wikiArticles,
      ideas,
      ideaVotes,
      polls,
      pollVotes,
      calendarEvents,
      documents,
      onboarding,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: { requesterId: userId },
        select: { id: true, orderNumber: true, type: true, status: true, netAmount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.absence.findMany({
        where: { userId },
        select: { id: true, type: true, status: true, startDate: true, endDate: true, note: true },
        orderBy: { startDate: "desc" },
      }),
      this.prisma.ticket.findMany({
        where: { OR: [{ requesterId: userId }, { assigneeId: userId }] },
        select: { id: true, title: true, description: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.ticketComment.findMany({
        where: { authorId: userId },
        select: { id: true, message: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.roomBooking.findMany({
        where: { userId },
        select: { id: true, title: true, startsAt: true, endsAt: true },
        orderBy: { startsAt: "desc" },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        select: { id: true, title: true, detail: true, createdAt: true, readAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.findMany({
        where: { actorId: userId },
        select: { id: true, action: true, entityType: true, detail: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.shift.findMany({
        where: { assigneeId: userId },
        select: { id: true, label: true, startsAt: true, endsAt: true, note: true },
        orderBy: { startsAt: "desc" },
      }),
      this.prisma.shiftSwap.findMany({
        where: { OR: [{ requesterId: userId }, { targetId: userId }] },
        select: { id: true, status: true, note: true, decisionNote: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      // Beide Seiten: wer etwas bekommen hat und wer es gebucht hat.
      this.prisma.custodyEvent.findMany({
        where: { OR: [{ personId: userId }, { actorId: userId }] },
        select: { id: true, kind: true, note: true, createdAt: true, item: { select: { title: true, kind: true } } },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.mealOrder.findMany({
        where: { userId },
        select: {
          id: true,
          quantity: true,
          note: true,
          createdAt: true,
          option: { select: { name: true } },
          offer: { select: { date: true, provider: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Ab hier Datenarten, die in der Auskunft fehlten, obwohl sie einen
      // Personenbezug tragen. Die Lesebestätigungen sind der wichtigste Fall:
      // `docs/datenschutz.md` führt sie selbst als heikelste Datenart, und
      // `loeschen()` entfernt sie ausdrücklich - in der Auskunft standen sie
      // trotzdem nicht.
      this.prisma.newsRead.findMany({
        where: { userId },
        select: { id: true, readAt: true, newsPost: { select: { title: true } } },
        orderBy: { readAt: "desc" },
      }),
      this.prisma.newsComment.findMany({
        where: { authorId: userId },
        select: { id: true, message: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.orderComment.findMany({
        where: { authorId: userId },
        select: { id: true, message: true, createdAt: true, order: { select: { orderNumber: true } } },
        orderBy: { createdAt: "desc" },
      }),
      // Freigabeentscheidungen: die Person hat hier gehandelt, nicht beantragt.
      this.prisma.approvalDecision.findMany({
        where: { actorId: userId },
        select: { id: true, decision: true, note: true, order: { select: { orderNumber: true } } },
      }),
      this.prisma.wikiArticle.findMany({
        where: { authorId: userId },
        select: { id: true, title: true, category: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.idea.findMany({
        where: { authorId: userId },
        select: { id: true, title: true, category: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.ideaVote.findMany({
        where: { userId },
        select: { id: true, createdAt: true, idea: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.poll.findMany({
        where: { authorId: userId },
        select: { id: true, question: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.pollVote.findMany({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          option: { select: { label: true, poll: { select: { question: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.calendarEvent.findMany({
        where: { organizerId: userId },
        select: { id: true, title: true, startsAt: true, endsAt: true },
        orderBy: { startsAt: "desc" },
      }),
      this.prisma.document.findMany({
        where: { ownerId: userId },
        select: { id: true, title: true, category: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.onboardingAssignment.findMany({
        where: { userId },
        select: {
          id: true,
          startDate: true,
          createdAt: true,
          template: { select: { name: true } },
          items: { select: { id: true, doneAt: true, step: { select: { title: true } } } },
        },
        orderBy: { startDate: "desc" },
      }),
    ]);

    // Der Abruf selbst gehört ins Protokoll. Er ist der weitreichendste
    // Lesezugriff der Anwendung - der gesamte Datenbestand einer Person in
    // einer Datei. Blieb er unprotokolliert, könnte jedes Konto mit
    // privacy.manage jede Person des Hauses auslesen, ohne dass es je
    // nachvollziehbar wäre; Art. 5 Abs. 2 DSGVO verlangt das Gegenteil.
    await this.audit.log({
      actor,
      action: "privacy.auskunft",
      entityType: "user",
      entityId: userId,
      detail: `Auskunft nach Art. 15 DSGVO über "${user.username}" erstellt`,
    });

    return {
      erstelltAm: new Date().toISOString(),
      hinweis:
        "Auskunft nach Art. 15 DSGVO. Enthalten sind alle Datensätze, die dieser Person über ein Datenfeld " +
        "zugeordnet sind. Was sich nicht über ein Datenfeld finden lässt, steht unter " +
        '"nichtMaschinellErfassbar" - diese Stellen muss das Haus durchsehen.',
      person: {
        id: user.id,
        benutzername: user.username,
        name: displayName(user),
        email: user.email,
        telefon: user.phone,
        mobil: user.mobile,
        funktion: user.jobTitle,
        standort: user.location?.name ?? null,
        abteilung: user.department?.name ?? null,
        fachbereich: user.specialtyArea?.name ?? null,
        rollen: user.roles.map((entry) => entry.role.name),
        zielgruppen: user.scopes,
        status: user.status,
        angelegtAm: user.createdAt.toISOString(),
        letzteAnmeldung: user.lastLoginAt?.toISOString() ?? null,
        anonymisiertAm: user.anonymizedAt?.toISOString() ?? null,
      },
      vorgaenge: {
        bestellungen: orders,
        abwesenheiten: absences,
        serviceanfragen: tickets,
        kommentareZuServiceanfragen: ticketComments,
        raumbuchungen: roomBookings,
        benachrichtigungen: notifications,
        protokollierteAktionen: auditLogs,
        schichten: shifts,
        diensttausch: shiftSwaps,
        verwahrung: custody,
        essensbestellungen: mealOrders,
        lesebestaetigungen: newsReads,
        kommentareZuBeitraegen: newsComments,
        kommentareZuBestellungen: orderComments,
        getroffeneFreigabeentscheidungen: approvalDecisions,
        verfassteWikiArtikel: wikiArticles,
        eingereichteIdeen: ideas,
        ideenstimmen: ideaVotes,
        angelegteUmfragen: polls,
        umfragestimmen: pollVotes,
        organisierteTermine: calendarEvents,
        verantworteteDokumente: documents,
        einarbeitung: onboarding,
      },
      nichtMaschinellErfassbar: {
        hinweis:
          "In folgenden Freitexten kann die Person genannt sein, ohne dass ein Datenfeld darauf verweist. Eine vollständige Auskunft verlangt hier eine Durchsicht durch das Haus.",
        stellen: FREITEXT_STELLEN,
      },
      aufbewahrung: RETENTION_RULES.map((rule) => ({
        datenart: rule.label,
        frist: `${rule.days} Tage`,
        behandlung: rule.mode === "delete" ? "wird automatisch gelöscht" : "bleibt aufbewahrungspflichtig erhalten",
        begruendung: rule.reason,
      })),
    };
  }

  /* ------------------------------------------------------------ Löschung */

  /**
   * Löschung nach Art. 17 DSGVO als Anonymisierung.
   *
   * Ein hartes Löschen würde freigegebene Bestellungen und Freigabeentscheidungen
   * mitreißen, die zehn Jahre aufbewahrt werden müssen. Deshalb verliert das
   * Konto seine Identität, bleibt aber als Anker der Vorgänge bestehen. Was rein
   * persönliche Spur ohne Beweiswert ist, wird wirklich entfernt.
   */
  async loeschen(actor: RequestUser, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, firstName: true, lastName: true, status: true, anonymizedAt: true },
    });
    if (!user) {
      throw new NotFoundException("Person nicht gefunden");
    }
    if (user.anonymizedAt) {
      throw new BadRequestException("Diese Person ist bereits anonymisiert.");
    }
    if (user.id === actor.id) {
      // Sonst stünde niemand mehr zur Verfügung, der den Vorgang abschließen
      // oder korrigieren kann - und das Audit-Log verlöre seinen Urheber.
      throw new BadRequestException(
        "Das eigene Konto kann nicht anonymisiert werden. Bitte von einem zweiten Administrationskonto ausführen.",
      );
    }

    const name = displayName(user);

    // Alles in **einer** Transaktion. Der Vorgang ist unumkehrbar; bräche er
    // zwischen zwei Schritten ab, bliebe entweder ein anonymisiertes Konto mit
    // Rechten stehen oder eines, dessen Spuren gelöscht sind, während die
    // Identität noch dranhängt. Beides wäre schlimmer als ein sauberer Abbruch.
    const { notifications, newsReads, ideaVotes, pollVotes } = await this.prisma.$transaction(async (tx) => {
      // Reine Aktivitätsspuren: kein Beweiswert, voller Personenbezug.
      const entfernt = {
        notifications: await tx.notification.deleteMany({ where: { userId } }),
        newsReads: await tx.newsRead.deleteMany({ where: { userId } }),
        ideaVotes: await tx.ideaVote.deleteMany({ where: { userId } }),
        pollVotes: await tx.pollVote.deleteMany({ where: { userId } }),
      };

      await tx.user.update({ where: { id: userId }, data: anonymisierteFelder(userId) });

      // Rollen entziehen: ein anonymisiertes Konto darf keine Rechte mehr tragen.
      await tx.userRole.deleteMany({ where: { userId } });

      return entfernt;
    });

    await this.audit.log({
      actor,
      action: "privacy.anonymize",
      entityType: "user",
      entityId: userId,
      // Der Name gehört ins Protokoll, damit der Vorgang belegbar bleibt -
      // das ist der Zweck des Audit-Logs und von der Frist gedeckt.
      detail: `Konto "${user.username}" (${name}) auf Verlangen anonymisiert`,
      metadata: {
        entfernt: {
          benachrichtigungen: notifications.count,
          lesebestaetigungen: newsReads.count,
          ideenstimmen: ideaVotes.count,
          umfragestimmen: pollVotes.count,
        },
      },
    });

    return {
      ok: true,
      entfernt: {
        benachrichtigungen: notifications.count,
        lesebestaetigungen: newsReads.count,
        ideenstimmen: ideaVotes.count,
        umfragestimmen: pollVotes.count,
      },
      hinweis:
        "Bestellungen, Freigaben und Protokolleinträge bleiben aufbewahrungspflichtig erhalten, sind aber keiner Person mehr zuzuordnen. Freitexte müssen von Hand durchgesehen werden.",
      durchzusehen: FREITEXT_STELLEN,
    };
  }

  /* -------------------------------------------------------- Aufbewahrung */

  /**
   * Wann der Aufräumlauf zuletzt lief.
   *
   * Aus dem Audit-Log statt aus einer eigenen Tabelle: der Lauf schreibt dort
   * ohnehin seinen Eintrag, und eine zweite Buchführung über dieselbe Tatsache
   * geht irgendwann auseinander.
   */
  async laufStatus(now: Date = new Date()): Promise<LaufStatus> {
    const letzter = await this.prisma.auditLog.findFirst({
      where: { action: "privacy.retention_run" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, actorUsername: true },
    });

    if (!letzter) {
      return {
        zuletzt: null,
        stundenHer: null,
        ueberfaellig: true,
        ausgeloestVon: null,
        hinweis:
          "Es ist noch kein Aufbewahrungslauf protokolliert. Solange keiner läuft, greift keine der unten genannten Fristen.",
      };
    }

    const stundenHer = Math.floor((now.getTime() - letzter.createdAt.getTime()) / 3_600_000);
    const ueberfaellig = stundenHer >= LAUF_UEBERFAELLIG_STUNDEN;

    return {
      zuletzt: letzter.createdAt.toISOString(),
      stundenHer,
      ueberfaellig,
      ausgeloestVon: letzter.actorUsername,
      hinweis: ueberfaellig
        ? `Der letzte Lauf liegt ${stundenHer} Stunden zurück. Bitte die Zeitsteuerung prüfen - solange kein Lauf stattfindet, greift keine Frist.`
        : `Letzter Lauf vor ${stundenHer} Stunde(n).`,
    };
  }

  /** Was die Fristen heute betreffen würden - ohne etwas zu verändern. */
  async vorschau(now: Date = new Date()): Promise<AufraeumErgebnis[]> {
    return this.durchlauf(now, false);
  }

  /**
   * Setzt die Fristen durch.
   *
   * Läuft ausdrücklich nicht automatisch im Hintergrund: bei mehreren
   * API-Instanzen liefe er mehrfach, und ein Löschlauf gehört dorthin, wo er
   * beobachtet wird. Aufruf über `scripts/aufbewahrung.ts` (Cron) oder aus der
   * Adminoberfläche.
   */
  async aufraeumen(actor: RequestUser | null, now: Date = new Date()): Promise<AufraeumErgebnis[]> {
    const ergebnis = await this.durchlauf(now, true);
    const gesamt = ergebnis.reduce((summe, eintrag) => summe + eintrag.entfernt, 0);

    // Auch der Lauf per Cron gehört ins Protokoll. Vorher schrieb nur der
    // Aufruf aus der Oberfläche einen Eintrag - ausgerechnet der Regelbetrieb
    // hinterliess also keine Spur, und sein Ausbleiben fiel niemandem auf.
    await this.audit.log({
      actor: actor ?? { id: null, username: SYSTEM_AKTEUR },
      action: "privacy.retention_run",
      entityType: "retention",
      entityId: "*",
      detail: `Aufbewahrungslauf: ${gesamt} Datensätze gelöscht oder anonymisiert`,
      metadata: { ergebnis, ausgeloestVon: actor ? "oberflaeche" : "cron" },
    });
    this.logger.log(`Aufbewahrungslauf abgeschlossen: ${gesamt} Datensätze gelöscht oder anonymisiert`);

    return ergebnis;
  }

  private async durchlauf(now: Date, wirklichAusfuehren: boolean): Promise<AufraeumErgebnis[]> {
    const ergebnis: AufraeumErgebnis[] = [];

    for (const rule of deletableRules()) {
      const cutoff = cutoffDate(rule, now);
      const entfernt = wirklichAusfuehren ? await this.loescheNach(rule, cutoff) : await this.zaehleVor(rule, cutoff);
      ergebnis.push({ key: rule.key, label: rule.label, days: rule.days, cutoff: cutoff.toISOString(), entfernt });
    }

    for (const rule of anonymizableRules()) {
      const cutoff = cutoffDate(rule, now);
      const entfernt = wirklichAusfuehren
        ? await this.anonymisiereNach(rule, cutoff, now)
        : await this.zaehleAnonymisierbare(rule, cutoff);
      ergebnis.push({
        key: rule.key,
        label: rule.label,
        days: rule.days,
        cutoff: cutoff.toISOString(),
        entfernt,
        behandlung: "anonymisiert",
      });
    }

    return ergebnis;
  }

  /**
   * Konten, deren Frist abgelaufen ist: Kandidaten der Anonymisierung.
   *
   * Nur inaktive Konten mit gesetztem Austrittszeitpunkt, die noch nicht
   * anonymisiert sind. Ein Konto ohne `inactiveSince` - etwa eines, das vor
   * dieser Regel deaktiviert wurde - bleibt bewusst unberührt: die Frist ohne
   * Anfangszeitpunkt zu raten hieße, sie an `updatedAt` zu hängen und damit an
   * jeder Nebensächlichkeit.
   */
  private kandidatenFilter(cutoff: Date) {
    return { status: "inactive" as const, anonymizedAt: null, inactiveSince: { not: null, lt: cutoff } };
  }

  private async zaehleAnonymisierbare(_rule: RetentionRule, cutoff: Date): Promise<number> {
    return this.prisma.user.count({ where: this.kandidatenFilter(cutoff) });
  }

  /**
   * Anonymisiert ausgeschiedene Konten, deren Frist abgelaufen ist.
   *
   * Dieselben Felder wie bei der Löschung auf Verlangen (Art. 17) - der Anlass
   * ist ein anderer, das Ergebnis muss dasselbe sein. Jedes Konto in einer
   * eigenen Transaktion: ein Fehler bei einem soll die übrigen nicht
   * zurückdrehen, und ein halb anonymisiertes Konto darf es nicht geben.
   */
  private async anonymisiereNach(rule: RetentionRule, cutoff: Date, now: Date): Promise<number> {
    const kandidaten = await this.prisma.user.findMany({
      where: this.kandidatenFilter(cutoff),
      select: { id: true, username: true },
    });

    let erledigt = 0;
    for (const kandidat of kandidaten) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.notification.deleteMany({ where: { userId: kandidat.id } });
          await tx.newsRead.deleteMany({ where: { userId: kandidat.id } });
          await tx.ideaVote.deleteMany({ where: { userId: kandidat.id } });
          await tx.pollVote.deleteMany({ where: { userId: kandidat.id } });
          await tx.user.update({ where: { id: kandidat.id }, data: anonymisierteFelder(kandidat.id, now) });
          await tx.userRole.deleteMany({ where: { userId: kandidat.id } });
        });
        erledigt += 1;
      } catch (error) {
        // Nicht den ganzen Lauf abbrechen: die übrigen Fristen sollen greifen.
        this.logger.error(`Konto ${kandidat.username} konnte nicht anonymisiert werden (${rule.key})`, error as Error);
      }
    }

    return erledigt;
  }

  /**
   * Zuordnung Frist → Tabelle.
   *
   * Bewusst ein ausgeschriebener Zweig je Datenart statt dynamischem Zugriff
   * über `this.prisma[name]`: so prüft der Compiler mit, und eine neue Frist
   * ohne Umsetzung fällt beim Übersetzen auf, nicht erst zur Laufzeit.
   */
  private async loescheNach(rule: RetentionRule, cutoff: Date): Promise<number> {
    switch (rule.key) {
      case "notification":
        return (await this.prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } })).count;
      case "news_read":
        return (await this.prisma.newsRead.deleteMany({ where: { readAt: { lt: cutoff } } })).count;
      case "audit_log":
        return (await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })).count;
      case "room_booking":
        return (await this.prisma.roomBooking.deleteMany({ where: { endsAt: { lt: cutoff } } })).count;
      case "ticket":
        return (await this.prisma.ticket.deleteMany({ where: { createdAt: { lt: cutoff }, status: "geloest" } })).count;
      case "absence":
        // Krankmeldungen gehen einen eigenen, kürzeren Weg - siehe unten.
        return (await this.prisma.absence.deleteMany({ where: { endDate: { lt: cutoff }, type: { not: "krank" } } }))
          .count;
      case "absence_sick":
        return (await this.prisma.absence.deleteMany({ where: { endDate: { lt: cutoff }, type: "krank" } })).count;
      case "shift":
        // Die Tauschvorgänge hängen am Fremdschlüssel und gehen mit.
        return (await this.prisma.shift.deleteMany({ where: { endsAt: { lt: cutoff } } })).count;
      case "custody":
        // Nur abgeschlossene Vorgänge: ein noch ausgegebener Schlüssel bleibt,
        // egal wie alt die Ausgabe ist - sonst verlöre das Haus die Spur.
        return (
          await this.prisma.custodyItem.deleteMany({
            where: { updatedAt: { lt: cutoff }, status: { in: ["abgeholt", "entsorgt"] } },
          })
        ).count;
      case "meal_order":
        return (await this.prisma.mealOrder.deleteMany({ where: { createdAt: { lt: cutoff } } })).count;
      default:
        // Erreichbar nur, wenn eine neue Regel mit `mode: "delete"` angelegt,
        // aber hier nicht umgesetzt wurde.
        throw new Error(`Für die Frist "${rule.key}" ist kein Löschweg hinterlegt.`);
    }
  }

  private async zaehleVor(rule: RetentionRule, cutoff: Date): Promise<number> {
    switch (rule.key) {
      case "notification":
        return this.prisma.notification.count({ where: { createdAt: { lt: cutoff } } });
      case "news_read":
        return this.prisma.newsRead.count({ where: { readAt: { lt: cutoff } } });
      case "audit_log":
        return this.prisma.auditLog.count({ where: { createdAt: { lt: cutoff } } });
      case "room_booking":
        return this.prisma.roomBooking.count({ where: { endsAt: { lt: cutoff } } });
      case "ticket":
        return this.prisma.ticket.count({ where: { createdAt: { lt: cutoff }, status: "geloest" } });
      case "absence":
        return this.prisma.absence.count({ where: { endDate: { lt: cutoff }, type: { not: "krank" } } });
      case "absence_sick":
        return this.prisma.absence.count({ where: { endDate: { lt: cutoff }, type: "krank" } });
      case "shift":
        return this.prisma.shift.count({ where: { endsAt: { lt: cutoff } } });
      case "custody":
        return this.prisma.custodyItem.count({
          where: { updatedAt: { lt: cutoff }, status: { in: ["abgeholt", "entsorgt"] } },
        });
      case "meal_order":
        return this.prisma.mealOrder.count({ where: { createdAt: { lt: cutoff } } });
      default:
        throw new Error(`Für die Frist "${rule.key}" ist kein Löschweg hinterlegt.`);
    }
  }
}
