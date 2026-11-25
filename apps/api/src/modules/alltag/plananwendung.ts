/**
 * Was beim Veröffentlichen eines Entwurfs geschieht - als reine Funktionen.
 *
 * Der Entwurf ist ein Zielzustand; hier wird er gegen den echten Plan gehalten:
 * was wird angelegt, geändert, entfernt, und wer erfährt davon. Zwischen
 * Datenbankabfragen versteckt ließe sich das nur mit laufender Datenbank prüfen.
 */
import { WOCHENTAGE, isoWochentag, lokaleUhrzeit, lokalesDatum, type PlanEntwurfItem } from "@ah-intranet/shared";

export interface LiveSchicht {
  id: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
  assigneeId: string | null;
  pauseMinuten: number;
  note: string | null;
  updatedAt: Date;
}

/** Hat sich das Element gegenüber der echten Schicht verändert? */
export function istGeaendert(live: LiveSchicht, item: PlanEntwurfItem): boolean {
  return (
    live.label !== item.label ||
    live.startsAt.getTime() !== new Date(item.startsAt).getTime() ||
    live.endsAt.getTime() !== new Date(item.endsAt).getTime() ||
    live.assigneeId !== item.assigneeId ||
    live.pauseMinuten !== item.pauseMinuten ||
    (live.note ?? null) !== (item.note ?? null)
  );
}

export interface Anwendung {
  anlegen: PlanEntwurfItem[];
  aendern: { item: PlanEntwurfItem; live: LiveSchicht }[];
  loeschen: LiveSchicht[];
  /** Echte Schichten, die der Entwurf ändern oder entfernen will, die sich seither aber geändert haben. */
  veraltet: LiveSchicht[];
  /** Verweise auf echte Schichten, die es nicht mehr gibt. */
  verschwunden: string[];
}

/**
 * Hält den Entwurf gegen den echten Plan.
 *
 * Unveränderte Elemente bleiben unberührt und werden auch nicht auf „veraltet"
 * geprüft: hat jemand anderes eine Schicht inzwischen geändert, die der Entwurf
 * gar nicht anfasst, ist das kein Konflikt.
 */
export function ermittleAnwendung(live: readonly LiveSchicht[], items: readonly PlanEntwurfItem[]): Anwendung {
  const nachId = new Map(live.map((schicht) => [schicht.id, schicht]));
  const ergebnis: Anwendung = { anlegen: [], aendern: [], loeschen: [], veraltet: [], verschwunden: [] };

  for (const item of items) {
    if (!item.liveId) {
      if (!item.geloescht) {
        ergebnis.anlegen.push(item);
      }
      continue;
    }
    const echt = nachId.get(item.liveId);
    if (!echt) {
      // Eine echte Schicht, die der Entwurf ohnehin entfernen wollte, ist schon weg: nichts zu tun.
      if (!item.geloescht) {
        ergebnis.verschwunden.push(item.liveId);
      }
      continue;
    }
    const anfassen = item.geloescht || istGeaendert(echt, item);
    if (!anfassen) {
      continue;
    }
    if (item.liveStand !== echt.updatedAt.toISOString()) {
      ergebnis.veraltet.push(echt);
      continue;
    }
    if (item.geloescht) {
      ergebnis.loeschen.push(echt);
    } else {
      ergebnis.aendern.push({ item, live: echt });
    }
  }
  return ergebnis;
}

/** „Di 06.01., 08:00–15:00 Uhr" in Ortszeit. */
export function zeitText(start: Date, ende: Date): string {
  const datum = lokalesDatum(start);
  const tag = WOCHENTAGE[isoWochentag(datum) - 1].kurz;
  return `${tag} ${datum.slice(8)}.${datum.slice(5, 7)}., ${lokaleUhrzeit(start)}–${lokaleUhrzeit(ende)} Uhr`;
}

/**
 * Was jede Person über die Veröffentlichung erfährt - eine Liste je Person, nie eine Meldung je Schicht.
 *
 * Wer eine Schicht neu bekommt, wer sie verliert und wessen Schicht sich in der
 * Zeit ändert, erfährt es; Änderungen, die nur Pause oder Notiz betreffen, nicht.
 */
export function meldungenJePerson(anwendung: Anwendung): Map<string, string[]> {
  const proPerson = new Map<string, string[]>();
  const merke = (userId: string | null, zeile: string) => {
    if (userId) {
      proPerson.set(userId, [...(proPerson.get(userId) ?? []), zeile]);
    }
  };
  const zeit = (item: { startsAt: Date | string; endsAt: Date | string }) =>
    zeitText(new Date(item.startsAt), new Date(item.endsAt));

  for (const item of anwendung.anlegen) {
    merke(item.assigneeId, `Neu: ${item.label}, ${zeit(item)}`);
  }
  for (const { item, live } of anwendung.aendern) {
    if (live.assigneeId !== item.assigneeId) {
      merke(item.assigneeId, `Neu: ${item.label}, ${zeit(item)}`);
      merke(live.assigneeId, `Entfällt: ${live.label}, ${zeit(live)}`);
    } else if (
      live.label !== item.label ||
      live.startsAt.getTime() !== new Date(item.startsAt).getTime() ||
      live.endsAt.getTime() !== new Date(item.endsAt).getTime()
    ) {
      merke(item.assigneeId, `Geändert: ${item.label}, ${zeit(item)} (vorher ${zeit(live)})`);
    }
  }
  for (const live of anwendung.loeschen) {
    merke(live.assigneeId, `Entfällt: ${live.label}, ${zeit(live)}`);
  }
  return proPerson;
}
