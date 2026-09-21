import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { RETENTION_RULES, type RetentionRule, cutoffDate, deletableRules } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { displayName } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";
import { FREITEXT_STELLEN, anonymisierteFelder } from "./anonymisierung";

export interface AufraeumErgebnis {
  key: string;
  label: string;
  days: number;
  cutoff: string;
  entfernt: number;
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
  async auskunft(userId: string) {
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
    ]);

    return {
      erstelltAm: new Date().toISOString(),
      hinweis:
        "Auskunft nach Art. 15 DSGVO. Enthalten sind alle Datensätze, die dieser Person über ein Datenfeld zugeordnet sind.",
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

    if (actor) {
      await this.audit.log({
        actor,
        action: "privacy.retention_run",
        entityType: "retention",
        entityId: "*",
        detail: `Aufbewahrungslauf: ${gesamt} Datensätze gelöscht`,
        metadata: { ergebnis },
      });
    }
    this.logger.log(`Aufbewahrungslauf abgeschlossen: ${gesamt} Datensätze gelöscht`);

    return ergebnis;
  }

  private async durchlauf(now: Date, wirklichLoeschen: boolean): Promise<AufraeumErgebnis[]> {
    const ergebnis: AufraeumErgebnis[] = [];

    for (const rule of deletableRules()) {
      const cutoff = cutoffDate(rule, now);
      const entfernt = wirklichLoeschen ? await this.loescheNach(rule, cutoff) : await this.zaehleVor(rule, cutoff);
      ergebnis.push({ key: rule.key, label: rule.label, days: rule.days, cutoff: cutoff.toISOString(), entfernt });
    }

    return ergebnis;
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
        return (await this.prisma.absence.deleteMany({ where: { endDate: { lt: cutoff } } })).count;
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
        return this.prisma.absence.count({ where: { endDate: { lt: cutoff } } });
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
