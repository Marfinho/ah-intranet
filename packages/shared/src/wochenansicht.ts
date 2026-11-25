/**
 * Rechnung hinter der Wochenansicht des Schichtplans: wie eine Schicht auf die
 * Tage einer Woche fällt, wie sich überlappende nebeneinander legen und was
 * Ziehen und Größe-Ändern aus den Zeiten macht.
 *
 * Reine Funktionen ohne Oberfläche, damit Browser und Tests dasselbe rechnen -
 * ein Schicht-Block, der nach dem Ziehen anderswo landet, als er losgelassen
 * wurde, ist ein Fehler, den man sonst nur von Hand findet.
 */
import { lokalZuUtc, lokaleMinuten, lokalesDatum, tagVerschieben } from "./zeit";

/** Raster, in dem Zeiten einrasten: Viertelstunden. */
export const RASTER_MINUTEN = 15;
/** Kürzer als das wird eine Schicht beim Größe-Ändern nicht. */
export const MINDESTDAUER_MINUTEN = 30;

export function runden(minuten: number, raster: number = RASTER_MINUTEN): number {
  return Math.round(minuten / raster) * raster;
}

export interface Zeiten {
  /** ISO-Zeitpunkt (UTC). */
  startsAt: string;
  endsAt: string;
}

export interface Segment {
  schichtId: string;
  /** Tag in Ortszeit, `YYYY-MM-DD`. */
  datum: string;
  /** Minuten seit Mitternacht; `bisMin` bis 1440. */
  vonMin: number;
  bisMin: number;
  /** Die Schicht beginnt in diesem Segment (nur dort lässt sich der Beginn ziehen). */
  beginntHier: boolean;
  /** Die Schicht endet in diesem Segment (nur dort lässt sich das Ende ziehen). */
  endetHier: boolean;
}

/**
 * Zerlegt eine Schicht in Tagessegmente der gezeigten Tage.
 * Eine Nachtschicht über Mitternacht ergibt zwei Segmente - sie stünde sonst
 * als ein Block über den Tagesrand hinaus. Ende genau um Mitternacht bleibt ein Segment.
 */
export function schichtSegmente(schicht: Zeiten & { id: string }, tage: readonly string[]): Segment[] {
  const start = new Date(schicht.startsAt);
  const ende = new Date(schicht.endsAt);
  const segmente: Segment[] = [];

  for (const datum of tage) {
    const tagBeginn = lokalZuUtc(datum, 0);
    const tagEnde = lokalZuUtc(datum, 1440);
    if (!(start < tagEnde && ende > tagBeginn)) {
      continue;
    }
    const beginntHier = start >= tagBeginn;
    const endetHier = ende <= tagEnde;
    segmente.push({
      schichtId: schicht.id,
      datum,
      vonMin: beginntHier ? lokaleMinuten(start) : 0,
      bisMin: !endetHier || ende.getTime() === tagEnde.getTime() ? 1440 : lokaleMinuten(ende),
      beginntHier,
      endetHier,
    });
  }
  return segmente;
}

export interface Platzierung extends Segment {
  /** Spalte innerhalb der Überlappungsgruppe, ab 0. */
  spalte: number;
  /** Wie viele Spalten die Gruppe braucht - bestimmt die Breite. */
  spalten: number;
}

/**
 * Legt Segmente eines Tages so nebeneinander, dass überlappende sich nicht verdecken.
 *
 * Eine Gruppe ist eine Kette sich überlappender Segmente; jede Gruppe teilt die
 * Tagesbreite unter ihren Spalten. Berühren sich zwei Segmente nur (Ende = Beginn),
 * überlappen sie nicht und stehen in voller Breite untereinander.
 */
export function ueberlappungsLayout(segmente: readonly Segment[]): Platzierung[] {
  const nachTag = new Map<string, Segment[]>();
  for (const segment of segmente) {
    nachTag.set(segment.datum, [...(nachTag.get(segment.datum) ?? []), segment]);
  }

  const ergebnis: Platzierung[] = [];
  for (const [, tagesSegmente] of [...nachTag].sort(([a], [b]) => a.localeCompare(b))) {
    const sortiert = [...tagesSegmente].sort(
      (a, b) => a.vonMin - b.vonMin || b.bisMin - a.bisMin || a.schichtId.localeCompare(b.schichtId),
    );

    let gruppe: Platzierung[] = [];
    let spaltenEnden: number[] = [];
    let gruppenEnde = -1;
    const abschliessen = () => {
      for (const eintrag of gruppe) {
        eintrag.spalten = spaltenEnden.length;
      }
      ergebnis.push(...gruppe);
      gruppe = [];
      spaltenEnden = [];
      gruppenEnde = -1;
    };

    for (const segment of sortiert) {
      if (segment.vonMin >= gruppenEnde) {
        abschliessen();
      }
      let spalte = spaltenEnden.findIndex((ende) => ende <= segment.vonMin);
      if (spalte === -1) {
        spalte = spaltenEnden.length;
        spaltenEnden.push(segment.bisMin);
      } else {
        spaltenEnden[spalte] = segment.bisMin;
      }
      gruppenEnde = Math.max(gruppenEnde, segment.bisMin);
      gruppe.push({ ...segment, spalte, spalten: 1 });
    }
    abschliessen();
  }
  return ergebnis;
}

/** Wandkonstante Verschiebung: Tage und Minuten in Ortszeit, nicht in UTC-Millisekunden. */
function verschobenerZeitpunkt(zeitpunkt: Date, deltaTage: number, deltaMinuten: number): Date {
  return lokalZuUtc(tagVerschieben(lokalesDatum(zeitpunkt), deltaTage), lokaleMinuten(zeitpunkt) + deltaMinuten);
}

/**
 * Verschiebt die ganze Schicht um Tage und Minuten.
 *
 * Gerechnet wird in Ortszeit: eine Frühschicht um 8 Uhr, einen Tag über die
 * Sommerzeitumstellung geschoben, bleibt eine um 8 Uhr.
 */
export function verschiebeSchicht(schicht: Zeiten, deltaTage: number, deltaMinuten: number): Zeiten {
  return {
    startsAt: verschobenerZeitpunkt(new Date(schicht.startsAt), deltaTage, deltaMinuten).toISOString(),
    endsAt: verschobenerZeitpunkt(new Date(schicht.endsAt), deltaTage, deltaMinuten).toISOString(),
  };
}

/** Zieht am Beginn: das Ende bleibt, die Schicht wird nie kürzer als die Mindestdauer. */
export function aendereBeginn(schicht: Zeiten, deltaMinuten: number): Zeiten {
  const ende = new Date(schicht.endsAt);
  let start = verschobenerZeitpunkt(new Date(schicht.startsAt), 0, deltaMinuten);
  if ((ende.getTime() - start.getTime()) / 60_000 < MINDESTDAUER_MINUTEN) {
    start = new Date(ende.getTime() - MINDESTDAUER_MINUTEN * 60_000);
  }
  return { startsAt: start.toISOString(), endsAt: schicht.endsAt };
}

/** Zieht am Ende: der Beginn bleibt, die Schicht wird nie kürzer als die Mindestdauer. */
export function aendereEnde(schicht: Zeiten, deltaMinuten: number): Zeiten {
  const start = new Date(schicht.startsAt);
  let ende = verschobenerZeitpunkt(new Date(schicht.endsAt), 0, deltaMinuten);
  if ((ende.getTime() - start.getTime()) / 60_000 < MINDESTDAUER_MINUTEN) {
    ende = new Date(start.getTime() + MINDESTDAUER_MINUTEN * 60_000);
  }
  return { startsAt: schicht.startsAt, endsAt: ende.toISOString() };
}
