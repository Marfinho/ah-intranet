/**
 * Schichtplanung als reine Funktionen: Zeitrechnung, Autoplanung und Prüfung
 * nach dem Arbeitszeitgesetz.
 *
 * Alles hier ergibt sich vollständig aus den Eingaben und gehört nicht zwischen
 * Datenbankabfragen. Die Planung muss außerdem nachvollziehbar und wiederholbar
 * sein: gleiche Eingabe, gleiches Ergebnis - ohne Zufall, damit der Plan, den
 * die Verwaltung in der Vorschau sieht, derselbe ist, der übernommen wird.
 *
 * Ortszeit ist fest Europe/Berlin. Ein Autohaus plant in seiner Ortszeit, und
 * die Sommerzeitumstellung darf eine Frühschicht nicht verschieben.
 */
import type { BetriebstagRef } from "../people/abwesenheitsregeln";

const ZONE = "Europe/Berlin";
const MINUTE = 60_000;

/* ------------------------------------------------------------ Zeitrechnung */

/** `HH:MM` → Minuten seit Mitternacht; `null` bei ungültiger Angabe. */
export function parseZeit(text: string): number | null {
  const treffer = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
  return treffer ? Number(treffer[1]) * 60 + Number(treffer[2]) : null;
}

function zonenVersatz(zeitpunkt: Date): number {
  const teile = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(zeitpunkt);
  const wert = (typ: string) => Number(teile.find((teil) => teil.type === typ)!.value);
  const alsUtc = Date.UTC(wert("year"), wert("month") - 1, wert("day"), wert("hour"), wert("minute"), wert("second"));
  return Math.round((alsUtc - Math.floor(zeitpunkt.getTime() / 1000) * 1000) / MINUTE);
}

/** Ortszeit (Datum + Minuten seit Mitternacht, auch über 1440) → UTC-Zeitpunkt. */
export function lokalZuUtc(datum: string, minuten: number): Date {
  const [jahr, monat, tag] = datum.split("-").map(Number);
  const nominal = Date.UTC(jahr, monat - 1, tag, 0, 0) + minuten * MINUTE;
  const erster = nominal - zonenVersatz(new Date(nominal)) * MINUTE;
  // Zweiter Durchgang: an der Umstellung stimmt der Versatz des ersten Versuchs nicht.
  return new Date(nominal - zonenVersatz(new Date(erster)) * MINUTE);
}

/** Datum (`YYYY-MM-DD`) in Ortszeit. */
export function lokalesDatum(zeitpunkt: Date): string {
  const teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(zeitpunkt);
  const wert = (typ: string) => teile.find((teil) => teil.type === typ)!.value;
  return `${wert("year")}-${wert("month")}-${wert("day")}`;
}

/** Uhrzeit (`HH:MM`) in Ortszeit. */
export function lokaleUhrzeit(zeitpunkt: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(zeitpunkt);
}

/** ISO-Wochentag eines Datums: 1 = Montag ... 7 = Sonntag. */
export function isoWochentag(datum: string): number {
  const tag = new Date(`${datum}T00:00:00Z`).getUTCDay();
  return tag === 0 ? 7 : tag;
}

function tagVerschieben(datum: string, tage: number): string {
  return new Date(new Date(`${datum}T00:00:00Z`).getTime() + tage * 86_400_000).toISOString().slice(0, 10);
}

/** Montag der Woche, in der das Datum liegt. */
export function wochenStart(datum: string): string {
  return tagVerschieben(datum, -(isoWochentag(datum) - 1));
}

export function tageZwischen(von: string, bis: string): string[] {
  const tage: string[] = [];
  for (let tag = von; tag <= bis; tag = tagVerschieben(tag, 1)) {
    tage.push(tag);
  }
  return tage;
}

/* --------------------------------------------------------------- Modelle */

export interface SchichtartRef {
  id: string;
  name: string;
  startZeit: string;
  endZeit: string;
  pauseMinuten: number;
  mindestBesetzung: number;
  idealBesetzung: number;
  tage: readonly number[];
  beiSondertag: boolean;
  locationId: string | null;
  departmentId: string | null;
  teamLeadId: string | null;
}

export interface PersonPlan {
  id: string;
  locationId: string | null;
  departmentId: string | null;
  managerId: string | null;
  wochenstunden: number | null;
  zeitfensterVon: string | null;
  zeitfensterBis: string | null;
  arbeitstage: readonly number[];
}

export interface Zeitblock {
  start: Date;
  ende: Date;
}

/** Start und Ende einer Schichtart an einem Tag; Ende <= Beginn heißt: über Mitternacht. */
export function schichtZeitraum(art: Pick<SchichtartRef, "startZeit" | "endZeit">, datum: string): Zeitblock {
  const start = parseZeit(art.startZeit) ?? 0;
  const endeRoh = parseZeit(art.endZeit) ?? 0;
  const ende = endeRoh <= start ? endeRoh + 1440 : endeRoh;
  return { start: lokalZuUtc(datum, start), ende: lokalZuUtc(datum, ende) };
}

/** Arbeitszeit ohne Pause, in Minuten. */
export function nettoMinuten(block: Zeitblock, pauseMinuten: number): number {
  return Math.round((block.ende.getTime() - block.start.getTime()) / MINUTE) - pauseMinuten;
}

export function inBereich(person: PersonPlan, art: SchichtartRef): boolean {
  return (
    (art.locationId === null || person.locationId === art.locationId) &&
    (art.departmentId === null || person.departmentId === art.departmentId) &&
    (art.teamLeadId === null || person.managerId === art.teamLeadId)
  );
}

/**
 * Liegt die Schicht im Zeitfenster der Person?
 * Ohne Fenster: ja. Eine Schicht über Mitternacht passt in kein Fenster - wer
 * nur vormittags kann, macht keine Nachtschicht.
 */
export function passtInZeitfenster(person: PersonPlan, art: SchichtartRef): boolean {
  if (!person.zeitfensterVon || !person.zeitfensterBis) {
    return true;
  }
  const von = parseZeit(person.zeitfensterVon);
  const bis = parseZeit(person.zeitfensterBis);
  const start = parseZeit(art.startZeit);
  const ende = parseZeit(art.endZeit);
  if (von === null || bis === null || start === null || ende === null) {
    return true;
  }
  return ende > start && start >= von && ende <= bis;
}

/* ------------------------------------------------------------ Tagesarten */

export interface Tagesarten {
  /** Tage, an denen nicht gearbeitet wird. */
  frei: ReadonlySet<string>;
  /** Tage, die laut Betriebskalender ausdrücklich Arbeitstage sind (verkaufsoffener Sonntag). */
  arbeit: ReadonlySet<string>;
}

/**
 * Was der Betriebskalender für diesen Standort an den einzelnen Tagen sagt.
 * Ein Eintrag für den Standort schlägt einen für das ganze Haus; auf gleicher
 * Ebene gewinnt „frei".
 */
export function tagesarten(betriebstage: readonly BetriebstagRef[], locationId: string | null): Tagesarten {
  const nachTag = new Map<string, { standort: BetriebstagRef[]; haus: BetriebstagRef[] }>();
  for (const eintrag of betriebstage) {
    if (eintrag.locationId !== null && eintrag.locationId !== locationId) {
      continue;
    }
    const gruppe = nachTag.get(eintrag.datum) ?? { standort: [], haus: [] };
    (eintrag.locationId === null ? gruppe.haus : gruppe.standort).push(eintrag);
    nachTag.set(eintrag.datum, gruppe);
  }
  const frei = new Set<string>();
  const arbeit = new Set<string>();
  for (const [datum, gruppe] of nachTag) {
    const massgeblich = gruppe.standort.length > 0 ? gruppe.standort : gruppe.haus;
    (massgeblich.some((eintrag) => eintrag.arbeitsfrei) ? frei : arbeit).add(datum);
  }
  return { frei, arbeit };
}

/** Wird diese Schichtart an dem Tag gefahren? */
export function giltAn(art: SchichtartRef, datum: string, tag: Tagesarten): boolean {
  if (tag.frei.has(datum)) {
    return false;
  }
  if (tag.arbeit.has(datum)) {
    return art.beiSondertag || art.tage.includes(isoWochentag(datum));
  }
  return art.tage.includes(isoWochentag(datum));
}

/* --------------------------------------------------------------- Planung */

export interface VorhandeneSchicht {
  userId: string;
  start: Date;
  ende: Date;
  pauseMinuten: number;
  schichtartId: string | null;
}

export interface PlanEingabe {
  /** `YYYY-MM-DD`, beide Grenzen eingeschlossen. */
  von: string;
  bis: string;
  arten: readonly SchichtartRef[];
  personen: readonly PersonPlan[];
  /** Schon bestehende Schichten - sie zählen zur Besetzung und zur Auslastung. */
  vorhanden: readonly VorhandeneSchicht[];
  /** Je Person die Tage, an denen sie ganztägig fehlt (genehmigte Abwesenheit). */
  abwesend: ReadonlyMap<string, ReadonlySet<string>>;
  betriebstage: readonly BetriebstagRef[];
}

export interface Zuweisung {
  schichtartId: string;
  datum: string;
  userId: string;
  start: Date;
  ende: Date;
  pauseMinuten: number;
}

export interface Luecke {
  schichtartId: string;
  datum: string;
  /** Idealbesetzung. */
  soll: number;
  mindest: number;
  besetzt: number;
  unterMindest: boolean;
}

export interface PlanErgebnis {
  zuweisungen: Zuweisung[];
  luecken: Luecke[];
}

/** Ruhezeit nach § 5 ArbZG in Minuten. */
export const RUHEZEIT_MINUTEN = 11 * 60;
/** Höchstarbeitszeit je Tag nach § 3 ArbZG (nur mit Ausgleich über acht Stunden). */
export const HOECHST_TAG_MINUTEN = 10 * 60;

interface Eintrag {
  start: Date;
  ende: Date;
  datum: string;
  netto: number;
}

/**
 * Plant Schichten für einen Zeitraum.
 *
 * Vorgehen je Tag: erst alle Schichtarten bis zur Mindestbesetzung füllen, dann
 * bis zur Idealbesetzung - sonst nähme die erste Schichtart die ganze Belegschaft
 * und die zweite stünde leer. Wer in Frage kommt, bestimmen harte Regeln
 * (Bereich, Arbeitstage, Zeitfenster, Abwesenheit, Betriebskalender, keine
 * Überschneidung, Wochenstunden, Höchstarbeitszeit, Ruhezeit); unter den
 * Geeigneten kommt zuerst, wer in der Woche am wenigsten ausgelastet ist.
 *
 * Die Planung erzeugt **nie** einen Verstoß gegen Ruhezeit oder Höchstarbeitszeit.
 * Was sie nicht besetzen kann, meldet sie als Lücke, statt Regeln zu biegen.
 */
export function planeSchichten(eingabe: PlanEingabe): PlanErgebnis {
  const tage = tageZwischen(eingabe.von, eingabe.bis);
  const arten = [...eingabe.arten].sort((a, b) => a.startZeit.localeCompare(b.startZeit) || a.id.localeCompare(b.id));

  const belegung = new Map<string, Eintrag[]>();
  const merke = (userId: string, start: Date, ende: Date, pause: number) => {
    const liste = belegung.get(userId) ?? [];
    liste.push({ start, ende, datum: lokalesDatum(start), netto: nettoMinuten({ start, ende }, pause) });
    belegung.set(userId, liste);
  };
  const besetzt = new Map<string, number>();
  for (const schicht of eingabe.vorhanden) {
    merke(schicht.userId, schicht.start, schicht.ende, schicht.pauseMinuten);
    if (schicht.schichtartId) {
      const schluessel = `${schicht.schichtartId}|${lokalesDatum(schicht.start)}`;
      besetzt.set(schluessel, (besetzt.get(schluessel) ?? 0) + 1);
    }
  }

  const tagesartenCache = new Map<string | null, Tagesarten>();
  const tagesartFuer = (locationId: string | null) => {
    if (!tagesartenCache.has(locationId)) {
      tagesartenCache.set(locationId, tagesarten(eingabe.betriebstage, locationId));
    }
    return tagesartenCache.get(locationId)!;
  };

  const anzahl = new Map<string, number>();
  const zuweisungen: Zuweisung[] = [];

  const geeignet = (
    person: PersonPlan,
    art: SchichtartRef,
    datum: string,
    block: Zeitblock,
    netto: number,
  ): boolean => {
    if (!inBereich(person, art) || !person.arbeitstage.includes(isoWochentag(datum))) {
      return false;
    }
    if (eingabe.abwesend.get(person.id)?.has(datum)) {
      return false;
    }
    if (!giltAn(art, datum, tagesartFuer(person.locationId)) || !passtInZeitfenster(person, art)) {
      return false;
    }
    if (person.wochenstunden !== null && person.wochenstunden <= 0) {
      return false;
    }

    const eintraege = belegung.get(person.id) ?? [];
    let tagSumme = netto;
    let wochenSumme = netto;
    const woche = wochenStart(datum);
    for (const e of eintraege) {
      if (e.start < block.ende && e.ende > block.start) {
        return false;
      }
      if (e.ende <= block.start && (block.start.getTime() - e.ende.getTime()) / MINUTE < RUHEZEIT_MINUTEN) {
        return false;
      }
      if (e.start >= block.ende && (e.start.getTime() - block.ende.getTime()) / MINUTE < RUHEZEIT_MINUTEN) {
        return false;
      }
      if (e.datum === datum) {
        tagSumme += e.netto;
      }
      if (wochenStart(e.datum) === woche) {
        wochenSumme += e.netto;
      }
    }
    if (tagSumme > HOECHST_TAG_MINUTEN) {
      return false;
    }
    return person.wochenstunden === null || wochenSumme <= person.wochenstunden * 60 + 0.001;
  };

  const auslastung = (person: PersonPlan, datum: string): number => {
    const woche = wochenStart(datum);
    const summe = (belegung.get(person.id) ?? [])
      .filter((e) => wochenStart(e.datum) === woche)
      .reduce((wert, e) => wert + e.netto, 0);
    return summe / ((person.wochenstunden ?? 40) * 60);
  };

  for (const datum of tage) {
    for (const stufe of ["mindest", "ideal"] as const) {
      for (const art of arten) {
        const soll = stufe === "mindest" ? art.mindestBesetzung : art.idealBesetzung;
        const schluessel = `${art.id}|${datum}`;
        const block = schichtZeitraum(art, datum);
        const netto = nettoMinuten(block, art.pauseMinuten);

        while ((besetzt.get(schluessel) ?? 0) < soll) {
          const kandidaten = eingabe.personen
            .filter((person) => geeignet(person, art, datum, block, netto))
            .sort(
              (a, b) =>
                auslastung(a, datum) - auslastung(b, datum) ||
                (anzahl.get(a.id) ?? 0) - (anzahl.get(b.id) ?? 0) ||
                a.id.localeCompare(b.id),
            );
          const gewaehlt = kandidaten[0];
          if (!gewaehlt) {
            break;
          }
          merke(gewaehlt.id, block.start, block.ende, art.pauseMinuten);
          anzahl.set(gewaehlt.id, (anzahl.get(gewaehlt.id) ?? 0) + 1);
          besetzt.set(schluessel, (besetzt.get(schluessel) ?? 0) + 1);
          zuweisungen.push({
            schichtartId: art.id,
            datum,
            userId: gewaehlt.id,
            start: block.start,
            ende: block.ende,
            pauseMinuten: art.pauseMinuten,
          });
        }
      }
    }
  }

  const luecken: Luecke[] = [];
  for (const datum of tage) {
    for (const art of arten) {
      if (!giltAn(art, datum, tagesartFuer(art.locationId))) {
        continue;
      }
      const aktuell = besetzt.get(`${art.id}|${datum}`) ?? 0;
      if (aktuell < art.idealBesetzung) {
        luecken.push({
          schichtartId: art.id,
          datum,
          soll: art.idealBesetzung,
          mindest: art.mindestBesetzung,
          besetzt: aktuell,
          unterMindest: aktuell < art.mindestBesetzung,
        });
      }
    }
  }

  return { zuweisungen, luecken };
}

/* ------------------------------------------------------ Arbeitszeitprüfung */

export type BefundArt = "ruhezeit" | "hoechstarbeitszeit" | "pause" | "wochenstunden";
export type BefundSchwere = "verstoss" | "hinweis";

export interface Befund {
  art: BefundArt;
  schwere: BefundSchwere;
  userId: string;
  datum: string;
  text: string;
}

export interface GeprueftSchicht {
  userId: string;
  start: Date;
  ende: Date;
  pauseMinuten: number;
}

/** Pause, die § 4 ArbZG für die Nettoarbeitszeit verlangt, in Minuten. */
export function geforderteGesetzlichePause(nettoArbeitsMinuten: number): number {
  if (nettoArbeitsMinuten > 9 * 60) {
    return 45;
  }
  return nettoArbeitsMinuten > 6 * 60 ? 30 : 0;
}

const stunden = (minuten: number) => `${(Math.round((minuten / 60) * 10) / 10).toString().replace(".", ",")} Stunden`;

/**
 * Prüft Schichten gegen das Arbeitszeitgesetz - **markiert nur**, blockiert nichts.
 *
 * - § 5: elf Stunden Ruhezeit zwischen zwei Schichten (Verstoß)
 * - § 3: mehr als zehn Stunden an einem Tag (Verstoß); mehr als acht (Hinweis:
 *   nur mit Ausgleich innerhalb von sechs Monaten zulässig)
 * - § 4: 30 Minuten Pause ab sechs, 45 ab neun Stunden Arbeitszeit (Verstoß)
 * - Wochenarbeitszeit über 48 Stunden oder über den vereinbarten Stunden (Hinweis)
 *
 * Nicht geprüft: Sonn- und Feiertagsarbeit (§§ 9-11), Jugendarbeitsschutz, der
 * Durchschnitt über sechs Monate und tarifliche Abweichungen.
 */
export function pruefeArbeitszeit(
  schichten: readonly GeprueftSchicht[],
  wochenstundenVon: ReadonlyMap<string, number | null> = new Map(),
): Befund[] {
  const befunde: Befund[] = [];
  const nachPerson = new Map<string, GeprueftSchicht[]>();
  for (const schicht of schichten) {
    nachPerson.set(schicht.userId, [...(nachPerson.get(schicht.userId) ?? []), schicht]);
  }

  for (const [userId, liste] of nachPerson) {
    const sortiert = [...liste].sort((a, b) => a.start.getTime() - b.start.getTime());
    const tage = new Map<string, number>();
    const wochen = new Map<string, number>();

    sortiert.forEach((schicht, index) => {
      const datum = lokalesDatum(schicht.start);
      const netto = nettoMinuten(schicht, schicht.pauseMinuten);
      tage.set(datum, (tage.get(datum) ?? 0) + netto);
      wochen.set(wochenStart(datum), (wochen.get(wochenStart(datum)) ?? 0) + netto);

      const verlangt = geforderteGesetzlichePause(netto);
      if (schicht.pauseMinuten < verlangt) {
        befunde.push({
          art: "pause",
          schwere: "verstoss",
          userId,
          datum,
          text: `Pause zu kurz: bei ${stunden(netto)} Arbeitszeit verlangt § 4 ArbZG mindestens ${verlangt} Minuten, eingeplant sind ${schicht.pauseMinuten}.`,
        });
      }

      const davor = sortiert[index - 1];
      if (davor) {
        const luecke = (schicht.start.getTime() - davor.ende.getTime()) / MINUTE;
        if (luecke < RUHEZEIT_MINUTEN) {
          befunde.push({
            art: "ruhezeit",
            schwere: "verstoss",
            userId,
            datum,
            text: `Ruhezeit unterschritten: zwischen dem Ende der Schicht um ${lokaleUhrzeit(davor.ende)} und dem Beginn um ${lokaleUhrzeit(schicht.start)} liegen ${stunden(luecke)}, § 5 ArbZG verlangt elf Stunden.`,
          });
        }
      }
    });

    for (const [datum, summe] of tage) {
      if (summe > HOECHST_TAG_MINUTEN) {
        befunde.push({
          art: "hoechstarbeitszeit",
          schwere: "verstoss",
          userId,
          datum,
          text: `Höchstarbeitszeit überschritten: ${stunden(summe)} an einem Tag, § 3 ArbZG erlaubt höchstens zehn.`,
        });
      } else if (summe > 8 * 60) {
        befunde.push({
          art: "hoechstarbeitszeit",
          schwere: "hinweis",
          userId,
          datum,
          text: `${stunden(summe)} an einem Tag: über acht Stunden ist nur mit Ausgleich innerhalb von sechs Monaten zulässig (§ 3 ArbZG).`,
        });
      }
    }

    const vereinbart = wochenstundenVon.get(userId) ?? null;
    for (const [woche, summe] of wochen) {
      if (summe > 48 * 60) {
        befunde.push({
          art: "wochenstunden",
          schwere: "hinweis",
          userId,
          datum: woche,
          text: `${stunden(summe)} in der Woche ab ${woche}: im Durchschnitt von sechs Monaten dürfen es 48 Stunden nicht übersteigen (§ 3 ArbZG).`,
        });
      } else if (vereinbart !== null && summe > vereinbart * 60 + 0.001) {
        befunde.push({
          art: "wochenstunden",
          schwere: "hinweis",
          userId,
          datum: woche,
          text: `${stunden(summe)} in der Woche ab ${woche}, vereinbart sind ${stunden(vereinbart * 60)}.`,
        });
      }
    }
  }

  return befunde.sort((a, b) => a.datum.localeCompare(b.datum) || a.userId.localeCompare(b.userId));
}

/** Befunde zur Schichtart selbst: Pause und Dauer, noch bevor jemand eingeteilt ist. */
export function pruefeSchichtart(art: Pick<SchichtartRef, "startZeit" | "endZeit" | "pauseMinuten">): {
  schwere: BefundSchwere;
  text: string;
}[] {
  const netto = nettoMinuten(schichtZeitraum(art, "2026-01-05"), art.pauseMinuten);
  const befunde: { schwere: BefundSchwere; text: string }[] = [];
  const verlangt = geforderteGesetzlichePause(netto);
  if (art.pauseMinuten < verlangt) {
    befunde.push({
      schwere: "verstoss",
      text: `Bei ${stunden(netto)} Arbeitszeit verlangt § 4 ArbZG mindestens ${verlangt} Minuten Pause, eingetragen sind ${art.pauseMinuten}.`,
    });
  }
  if (netto > HOECHST_TAG_MINUTEN) {
    befunde.push({
      schwere: "verstoss",
      text: `${stunden(netto)} Arbeitszeit überschreiten die Höchstgrenze von zehn Stunden (§ 3 ArbZG).`,
    });
  } else if (netto > 8 * 60) {
    befunde.push({
      schwere: "hinweis",
      text: `${stunden(netto)} Arbeitszeit: über acht Stunden nur mit Ausgleich zulässig (§ 3 ArbZG).`,
    });
  }
  return befunde;
}
