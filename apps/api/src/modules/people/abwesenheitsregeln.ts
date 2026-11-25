/**
 * Regeln für Abwesenheiten als reine Funktionen.
 *
 * Sie ergeben sich vollständig aus ihren Eingaben und gehören deshalb nicht
 * zwischen Datenbankabfragen (siehe CLAUDE.md, Konventionen).
 */
import { alleUnterstellten, type PersonRef } from "./organigramm";

/** `YYYY-MM-DD` eines UTC-Datums. */
function text(datum: Date): string {
  return datum.toISOString().slice(0, 10);
}

export interface BetriebstagRef {
  /** `YYYY-MM-DD` */
  datum: string;
  arbeitsfrei: boolean;
  /** `null` = ganzes Haus */
  locationId: string | null;
}

/**
 * Die Tage, an denen für diesen Standort nicht gearbeitet wird.
 *
 * Ein Eintrag für den Standort schlägt einen für das ganze Haus: wer
 * Allerheiligen im Haus freigibt, aber einem Standort „Arbeitstag" einträgt,
 * meint genau das. Auf gleicher Ebene gewinnt „frei" - im Zweifel zählt ein
 * Tag lieber nicht als Urlaubstag.
 */
export function freieTage(betriebstage: readonly BetriebstagRef[], locationId: string | null): Set<string> {
  const nachTag = new Map<string, { standort: BetriebstagRef[]; haus: BetriebstagRef[] }>();
  for (const eintrag of betriebstage) {
    const gilt = eintrag.locationId === null || eintrag.locationId === locationId;
    if (!gilt) {
      continue;
    }
    const gruppe = nachTag.get(eintrag.datum) ?? { standort: [], haus: [] };
    (eintrag.locationId === null ? gruppe.haus : gruppe.standort).push(eintrag);
    nachTag.set(eintrag.datum, gruppe);
  }

  const frei = new Set<string>();
  for (const [datum, gruppe] of nachTag) {
    const massgeblich = gruppe.standort.length > 0 ? gruppe.standort : gruppe.haus;
    if (massgeblich.some((eintrag) => eintrag.arbeitsfrei)) {
      frei.add(datum);
    }
  }
  return frei;
}

export interface ArbeitstageEingabe {
  von: Date;
  bis: Date;
  freieTage: ReadonlySet<string>;
  startHalb?: boolean;
  endHalb?: boolean;
}

/**
 * Arbeitstage eines Zeitraums für den Urlaubsanspruch.
 *
 * Montag bis Freitag, abzüglich der freien Tage des Betriebskalenders.
 * Samstag und Sonntag zählen nie - ein verkaufsoffener Sonntag macht aus einem
 * Urlaub keinen Urlaubstag, weil nicht jede Person dort arbeitet; wer dort
 * eingeteilt ist, steht im Schichtplan. Ein halber Tag zählt nur, wenn der Tag
 * selbst ein Arbeitstag ist.
 */
export function arbeitstage({ von, bis, freieTage: frei, startHalb, endHalb }: ArbeitstageEingabe): number {
  const zaehlt = (tag: Date) => {
    const wochentag = tag.getUTCDay();
    return wochentag !== 0 && wochentag !== 6 && !frei.has(text(tag));
  };

  const start = new Date(Date.UTC(von.getUTCFullYear(), von.getUTCMonth(), von.getUTCDate()));
  const ende = new Date(Date.UTC(bis.getUTCFullYear(), bis.getUTCMonth(), bis.getUTCDate()));

  let summe = 0;
  for (const cursor = new Date(start); cursor <= ende; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (zaehlt(cursor)) {
      summe += 1;
    }
  }

  if (start.getTime() === ende.getTime()) {
    return zaehlt(start) && (startHalb || endHalb) ? 0.5 : summe;
  }
  if (startHalb && zaehlt(start)) {
    summe -= 0.5;
  }
  if (endHalb && zaehlt(ende)) {
    summe -= 0.5;
  }
  return summe;
}

/** Krankmeldungen und Einträge für andere entstehen sofort gültig; nur der eigene Antrag braucht eine Freigabe. */
export function anfangsstatus(eingabe: { art: string; fuerAndere: boolean }): "approved" | "submitted" {
  return eingabe.art === "krank" || eingabe.fuerAndere ? "approved" : "submitted";
}

export interface ErfassungsEingabe {
  akteurId: string;
  zielId: string;
  personen: readonly PersonRef[];
  /** Darf Abwesenheiten freigeben (`absences.approve`). */
  darfFreigeben: boolean;
  /** Sieht alle Abwesenheiten des Hauses (`absences.viewAll`). */
  sieheAlle: boolean;
}

/**
 * Darf der Akteur eine Abwesenheit für die Zielperson eintragen?
 *
 * Die eigene immer. Für andere nur mit Freigaberecht, und dann nur für
 * Unterstellte - auch mittelbar - oder, mit dem Recht auf alle Abwesenheiten,
 * für jede Person. Eine Abteilungsleitung trägt also für ihre Abteilung ein,
 * nicht für die Nachbarabteilung.
 */
export function darfErfassen({ akteurId, zielId, personen, darfFreigeben, sieheAlle }: ErfassungsEingabe): boolean {
  if (akteurId === zielId) {
    return true;
  }
  if (!darfFreigeben) {
    return false;
  }
  return sieheAlle || alleUnterstellten(personen, akteurId).includes(zielId);
}
