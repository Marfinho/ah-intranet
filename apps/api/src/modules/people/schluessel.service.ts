import { BadRequestException, Injectable } from "@nestjs/common";
import {
  SCHLUESSELFUNKTIONEN,
  SCHLUESSEL_STUFEN,
  VERTRETUNGS_MELDUNGEN,
  permissionName,
  schluesselfunktion,
  type SchluesselUebersicht,
  type SchluesselfunktionAnsicht,
  type VertretungsMeldung,
} from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { displayName } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";
import { requireTenantId } from "../../core/tenant-context";
import { PeopleService } from "./people.service";
import {
  ampel,
  ausfallEmpfaenger,
  ausfallZeilen,
  darfLeeren,
  empfaengerBeiAbwesenheit,
  zustaendig,
  type AusfallFunktion,
} from "./schluesselregeln";

/** Der Teil einer Abwesenheit, den die Meldung braucht. */
export interface AbwesenheitFuerMeldung {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  vertretungGemeldetAt?: Date | null;
}

const TAG_MS = 86_400_000;

function tagBeginn(datum: Date): Date {
  return new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
}

function datumText(datum: Date): string {
  return datum.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

/**
 * Schlüsselfunktionen: Key User, zwei Vertreter, danach die Geschäftsführung.
 *
 * Die Besetzung ist nur so viel wert, wie die Personen darin handeln können -
 * deshalb zählt eine Stufe nur, wenn das Konto aktiv ist, sich anmelden kann und
 * das Recht der Funktion trägt. Ein Konto, das nach der Besetzung sein Recht
 * verliert, macht die Funktion sichtbar rot, statt still wirkungslos zu werden.
 */
@Injectable()
export class SchluesselService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly people: PeopleService,
  ) {
    people.registriereKontoAusfall((ereignis) => this.meldeAusfall(ereignis));
  }

  /* ---------------------------------------------------------- Ansicht */

  /** Für alle angemeldeten Konten: wer ist wofür zuständig. Pflegemöglichkeiten nennt der Aufruf je Recht. */
  async uebersicht(user: RequestUser): Promise<SchluesselUebersicht> {
    const daten = await this.laden();
    const darfPflegen = can(user, "users.manage");

    const funktionen: SchluesselfunktionAnsicht[] = [];
    for (const funktion of SCHLUESSELFUNKTIONEN) {
      const gueltig = daten.gueltig.get(funktion.recht) ?? new Set<string>();
      const stufen = this.stufen(daten.besetzungen, funktion.key);
      const wirksam = zustaendig({ stufen, gueltig, abwesend: daten.abwesend });

      funktionen.push({
        key: funktion.key,
        name: funktion.name,
        beschreibung: funktion.beschreibung,
        recht: funktion.recht,
        stufen: SCHLUESSEL_STUFEN.map(({ stufe }) => {
          const userId = stufen[stufe];
          return {
            stufe,
            userId,
            name: userId ? (daten.namen.get(userId) ?? null) : null,
            gueltig: userId ? gueltig.has(userId) : false,
            abwesend: userId ? daten.abwesend.has(userId) : false,
          };
        }),
        zustaendig: wirksam
          ? {
              userId: wirksam.userId,
              name: daten.namen.get(wirksam.userId) ?? "",
              stufe: SCHLUESSEL_STUFEN[wirksam.stufe].name,
            }
          : null,
        ampel: ampel(stufen, gueltig),
        kandidaten: darfPflegen
          ? [...gueltig]
              .map((id) => ({ id, name: daten.namen.get(id) ?? "" }))
              .sort((a, b) => a.name.localeCompare(b.name, "de"))
          : [],
      });
    }

    return {
      funktionen,
      vertretungsMeldung: daten.vertretungsMeldung,
      geschaeftsfuehrungBesetzt: daten.eskalation.length > 0,
      // Nur wer die Eskalation erhält, bekommt auch die offenen Fälle gezeigt.
      offeneEskalationen: can(user, "schluessel.eskalation")
        ? funktionen.filter((funktion) => funktion.zustaendig === null).map((funktion) => funktion.name)
        : null,
    };
  }

  /* ----------------------------------------------------------- Pflege */

  async besetzen(
    actor: RequestUser,
    funktionKey: string,
    stufe: number,
    userId: string,
  ): Promise<SchluesselUebersicht> {
    const funktion = this.pruefeFunktion(funktionKey, stufe);

    const ziel = await this.prisma.user.findFirst({
      where: { id: userId, status: "active", loginEnabled: true },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!ziel) {
      throw new BadRequestException("Die Person ist in diesem Haus nicht verfügbar oder hat keinen Zugang.");
    }
    if (!(await this.people.usersWithPermission(funktion.recht)).includes(userId)) {
      throw new BadRequestException(
        `${displayName(ziel)} trägt das Recht "${permissionName(funktion.recht)}" nicht. ` +
          "Ohne dieses Recht könnte die Person im Vertretungsfall nichts tun.",
      );
    }

    const andere = await this.prisma.schluesselbesetzung.findFirst({
      where: { funktion: funktion.key, userId, NOT: { stufe } },
      select: { stufe: true },
    });
    if (andere) {
      throw new BadRequestException(
        `${displayName(ziel)} ist in dieser Funktion schon als ${SCHLUESSEL_STUFEN[andere.stufe].name} eingesetzt. ` +
          "Eine Person kann nicht zwei Stufen derselben Funktion tragen - sonst wäre die Vertretung keine.",
      );
    }

    const vorhanden = await this.prisma.schluesselbesetzung.findFirst({ where: { funktion: funktion.key, stufe } });
    if (vorhanden) {
      await this.prisma.schluesselbesetzung.update({ where: { id: vorhanden.id }, data: { userId } });
    } else {
      await this.prisma.schluesselbesetzung.create({ data: { funktion: funktion.key, stufe, userId } });
    }

    await this.audit.log({
      actor,
      action: "schluessel.besetzt",
      entityType: "schluesselfunktion",
      entityId: funktion.key,
      detail: `${displayName(ziel)} ist jetzt ${SCHLUESSEL_STUFEN[stufe].name} für ${funktion.name}`,
    });
    return this.uebersicht(actor);
  }

  async leeren(actor: RequestUser, funktionKey: string, stufe: number): Promise<SchluesselUebersicht> {
    const funktion = this.pruefeFunktion(funktionKey, stufe);
    const daten = await this.laden();
    const gueltig = daten.gueltig.get(funktion.recht) ?? new Set<string>();
    const stufen = this.stufen(daten.besetzungen, funktion.key);
    if (!stufen[stufe]) {
      return this.uebersicht(actor);
    }

    const zaehle = (liste: readonly (string | null)[]) => liste.filter((id) => id && gueltig.has(id)).length;
    const danach = stufen.map((id, index) => (index === stufe ? null : id));
    if (!darfLeeren({ gueltigVorher: zaehle(stufen), gueltigNachher: zaehle(danach) })) {
      throw new BadRequestException(
        `Für "${funktion.name}" müssen mindestens zwei Personen erreichbar bleiben. ` +
          "Setzen Sie zuerst jemand anderen ein, dann lässt sich diese Stufe ersetzen.",
      );
    }

    await this.prisma.schluesselbesetzung.deleteMany({ where: { funktion: funktion.key, stufe } });
    await this.audit.log({
      actor,
      action: "schluessel.geleert",
      entityType: "schluesselfunktion",
      entityId: funktion.key,
      detail: `${SCHLUESSEL_STUFEN[stufe].name} für ${funktion.name} ist wieder frei`,
    });
    return this.uebersicht(actor);
  }

  async setzeMeldung(actor: RequestUser, meldung: VertretungsMeldung): Promise<SchluesselUebersicht> {
    if (!VERTRETUNGS_MELDUNGEN.some((eintrag) => eintrag.key === meldung)) {
      throw new BadRequestException("Unbekannte Einstellung.");
    }
    await this.prisma.tenant.update({ where: { id: requireTenantId() }, data: { vertretungsMeldung: meldung } });
    await this.audit.log({
      actor,
      action: "schluessel.meldung",
      entityType: "schluesselfunktion",
      entityId: "einstellung",
      detail: `Meldung an Vertretungen: ${VERTRETUNGS_MELDUNGEN.find((eintrag) => eintrag.key === meldung)!.name}`,
    });
    return this.uebersicht(actor);
  }

  /* ------------------------------------------- Meldung bei Abwesenheit */

  /**
   * Informiert die Vertretungen, wenn ein Funktionsträger fehlt.
   *
   * Je nach Einstellung des Hauses sofort, erst am ersten Tag oder gar nicht.
   * Die Meldung nennt nur „abwesend" - der Grund bleibt, wo er hingehört. Ein
   * Merker an der Abwesenheit verhindert doppelte Mails, wenn Eintrag und
   * Tageslauf sich treffen.
   */
  async meldeAbwesenheit(absence: AbwesenheitFuerMeldung): Promise<boolean> {
    if (absence.vertretungGemeldetAt) {
      return false;
    }
    const heute = tagBeginn(new Date());
    if (absence.endDate < heute) {
      return false;
    }

    const daten = await this.laden();
    if (daten.vertretungsMeldung === "aus") {
      return false;
    }
    if (daten.vertretungsMeldung === "erster_tag" && absence.startDate.getTime() >= heute.getTime() + TAG_MS) {
      return false;
    }

    const meine = [
      ...new Set(daten.besetzungen.filter((eintrag) => eintrag.userId === absence.userId).map((e) => e.funktion)),
    ];
    const abwesenderName = daten.namen.get(absence.userId) ?? "Eine Person";
    const abwesend = await this.people.abwesendeAm(tagBeginn(absence.startDate < heute ? heute : absence.startDate));
    abwesend.add(absence.userId);

    // Je Empfänger eine Nachricht, auch wenn er in mehreren Funktionen gebraucht wird.
    const proEmpfaenger = new Map<string, string[]>();
    for (const key of meine) {
      const funktion = schluesselfunktion(key);
      if (!funktion) {
        continue;
      }
      const empfaenger = empfaengerBeiAbwesenheit({
        stufen: this.stufen(daten.besetzungen, key),
        abwesenderId: absence.userId,
        gueltig: daten.gueltig.get(funktion.recht) ?? new Set<string>(),
        abwesend,
        eskalation: daten.eskalation,
      });
      for (const { userId, rolle } of empfaenger) {
        const zeilen = proEmpfaenger.get(userId) ?? [];
        zeilen.push(
          rolle === "Geschäftsführung"
            ? `Geschäftsführung für ${funktion.name} (niemand sonst ist erreichbar)`
            : `${rolle} für ${funktion.name}`,
        );
        proEmpfaenger.set(userId, zeilen);
      }
    }

    const zeitraum = `vom ${datumText(absence.startDate)} bis ${datumText(absence.endDate)}`;
    for (const [userId, zeilen] of proEmpfaenger) {
      await this.notifications.notify({
        userIds: [userId],
        title: `${abwesenderName} ist abwesend - Sie vertreten`,
        detail: `${abwesenderName} fehlt ${zeitraum}. Sie sind in dieser Zeit: ${zeilen.join("; ")}.`,
        link: "/admin/schluesselfunktionen",
        auchPerMail: true,
      });
    }

    await this.prisma.absence.update({ where: { id: absence.id }, data: { vertretungGemeldetAt: new Date() } });
    if (proEmpfaenger.size > 0) {
      await this.audit.log({
        actor: { username: "system" },
        action: "schluessel.vertretung_gemeldet",
        entityType: "absence",
        entityId: absence.id,
        detail: `${proEmpfaenger.size} Vertretung(en) über die Abwesenheit von ${abwesenderName} informiert`,
      });
    }
    return true;
  }

  /* ----------------------------------------------- Ausfall eines Trägers */

  /**
   * Meldet, welche Stufen frei werden, wenn ein Träger deaktiviert wird oder den
   * Zugang verliert.
   *
   * Die Besetzung bleibt stehen - die Funktion zeigt dann „zählt nicht" und
   * die Ampel rot, so dass die Verwaltung den Ersatz sieht und nicht eine
   * stillschweigend geleerte Stufe. Gemeldet wird immer, auch bei „Meldung aus":
   * die Einstellung regelt Abwesenheiten, hier fehlt dauerhaft jemand.
   *
   * @returns den Hinweistext für die ausführende Person, oder `null`, wenn die Person nichts hielt.
   */
  async meldeAusfall(ereignis: { userId: string; actor: RequestUser; anlass: string }): Promise<string | null> {
    const daten = await this.laden();
    if (!daten.besetzungen.some((eintrag) => eintrag.userId === ereignis.userId)) {
      return null;
    }

    // `laden()` filtert auf aktive Konten mit Zugang: der ausgefallene Träger fehlt in den gültigen Mengen schon.
    const funktionen: AusfallFunktion[] = SCHLUESSELFUNKTIONEN.map((funktion) => ({
      key: funktion.key,
      name: funktion.name,
      stufen: this.stufen(daten.besetzungen, funktion.key),
      gueltigNachher: new Set([...(daten.gueltig.get(funktion.recht) ?? [])].filter((id) => id !== ereignis.userId)),
    }));
    const zeilen = ausfallZeilen(ereignis.userId, funktionen);
    if (zeilen.length === 0) {
      return null;
    }

    const name = daten.namen.get(ereignis.userId) ?? "Ein Konto";
    const aufzaehlung = zeilen
      .map(
        (zeile) =>
          `- ${zeile.funktion}: ${zeile.freigewordeneStufen.join(", ")} nicht mehr besetzt - ` +
          (zeile.unterbesetzt
            ? `nur noch ${zeile.verbleibend} von ${SCHLUESSEL_STUFEN.length} erreichbar, Mindestbesetzung unterschritten`
            : `noch ${zeile.verbleibend} von ${SCHLUESSEL_STUFEN.length} besetzt`),
      )
      .join("\n");
    const hinweis = `${name} ${ereignis.anlass}. Dadurch sind in Schlüsselfunktionen nicht mehr besetzt:\n${aufzaehlung}`;

    const empfaenger = ausfallEmpfaenger({
      traegerId: ereignis.userId,
      funktionen,
      eskalation: daten.eskalation,
    }).filter((eintrag) => eintrag.userId !== ereignis.actor.id);

    for (const eintrag of empfaenger) {
      await this.notifications.notify({
        userIds: [eintrag.userId],
        title: `${name} ${ereignis.anlass} - Schlüsselfunktion nicht mehr besetzt`,
        detail: `${hinweis}\n\nBitte sorgen Sie für Ersatz (Administration → Schlüsselfunktionen).`,
        link: "/admin/schluesselfunktionen",
        auchPerMail: true,
      });
    }

    await this.audit.log({
      actor: ereignis.actor,
      action: "schluessel.traeger_ausgefallen",
      entityType: "schluesselfunktion",
      entityId: ereignis.userId,
      detail: `${name} ${ereignis.anlass}; ${zeilen.length} Funktion(en) betroffen, ${empfaenger.length} Person(en) informiert`,
    });
    return hinweis;
  }

  /** Tageslauf: Abwesenheiten, die laufen oder beginnen und noch nicht gemeldet sind. */
  async meldeFaellige(): Promise<number> {
    const heute = tagBeginn(new Date());
    const rows = await this.prisma.absence.findMany({
      where: {
        status: "approved",
        vertretungGemeldetAt: null,
        startDate: { lt: new Date(heute.getTime() + TAG_MS) },
        endDate: { gte: heute },
      },
      select: { id: true, userId: true, startDate: true, endDate: true, vertretungGemeldetAt: true },
    });
    let gemeldet = 0;
    for (const row of rows) {
      if (await this.meldeAbwesenheit(row)) {
        gemeldet += 1;
      }
    }
    return gemeldet;
  }

  /* ----------------------------------------------------------- Helfer */

  private pruefeFunktion(key: string, stufe: number) {
    const funktion = schluesselfunktion(key);
    if (!funktion) {
      throw new BadRequestException(`Unbekannte Schlüsselfunktion: ${key}`);
    }
    if (!Number.isInteger(stufe) || stufe < 0 || stufe >= SCHLUESSEL_STUFEN.length) {
      throw new BadRequestException("Unbekannte Stufe.");
    }
    return funktion;
  }

  private stufen(besetzungen: { funktion: string; stufe: number; userId: string }[], key: string): (string | null)[] {
    return SCHLUESSEL_STUFEN.map(
      ({ stufe }) => besetzungen.find((eintrag) => eintrag.funktion === key && eintrag.stufe === stufe)?.userId ?? null,
    );
  }

  private async laden() {
    const [besetzungen, tenant, abwesend, eskalation] = await Promise.all([
      this.prisma.schluesselbesetzung.findMany({ select: { funktion: true, stufe: true, userId: true } }),
      this.prisma.tenant.findUniqueOrThrow({
        where: { id: requireTenantId() },
        select: { vertretungsMeldung: true },
      }),
      this.people.abwesendeAm(new Date()),
      this.people.usersWithPermission("schluessel.eskalation"),
    ]);

    // Wer die Geschäftsführung nicht besetzt hat, wird nicht ins Leere eskaliert:
    // die Benutzerverwaltung ist der nächste Anlaufpunkt.
    const eskalationsziele = eskalation.length > 0 ? eskalation : await this.people.usersWithPermission("users.manage");

    const gueltig = new Map<string, Set<string>>();
    for (const recht of new Set(SCHLUESSELFUNKTIONEN.map((funktion) => funktion.recht))) {
      gueltig.set(recht, new Set(await this.people.usersWithPermission(recht)));
    }

    const ids = new Set<string>([
      ...besetzungen.map((eintrag) => eintrag.userId),
      ...[...gueltig.values()].flatMap((menge) => [...menge]),
      ...eskalation,
    ]);
    const personen = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, firstName: true, lastName: true },
    });

    return {
      besetzungen,
      vertretungsMeldung: tenant.vertretungsMeldung as VertretungsMeldung,
      abwesend,
      gueltig,
      eskalation: eskalationsziele,
      namen: new Map(personen.map((person) => [person.id, displayName(person)])),
    };
  }
}
