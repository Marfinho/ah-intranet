import type { ShiftSwapStatus } from "@ah-intranet/shared";

/**
 * Reine Regeln der Alltagsmodule.
 *
 * Bewusst ohne Datenbank: Was wer bei einem Tauschvorgang tun darf und ob sich
 * zwei Schichten überschneiden, sind Entscheidungen, die sich vollständig aus
 * ihren Eingaben ergeben. In einem Dienst zwischen Abfragen versteckt wären sie
 * nur mit laufender Datenbank prüfbar - und genau solche Regeln verrutschen
 * still.
 */

export interface Zeitraum {
  startsAt: Date;
  endsAt: Date;
}

/**
 * Überschneiden sich zwei Zeiträume?
 *
 * Berührung zählt nicht: Wer um 15 Uhr aufhört, darf um 15 Uhr anfangen.
 */
export function ueberschneidet(a: Zeitraum, b: Zeitraum): boolean {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}

export interface Tauschbeteiligte {
  requesterId: string;
  targetId: string;
}

export interface Tauschrechte {
  canRespond: boolean;
  canDecide: boolean;
  canWithdraw: boolean;
}

/**
 * Was die angemeldete Person an diesem Tauschvorgang tun darf.
 *
 * Die drei Fälle schließen einander nicht aus, hängen aber an verschiedenen
 * Dingen: Antworten an der Person, Freigeben am Recht, Zurückziehen wieder an
 * der Person. Ein abgeschlossener Vorgang lässt nichts davon zu.
 */
export function tauschrechte(
  status: ShiftSwapStatus,
  beteiligte: Tauschbeteiligte,
  userId: string,
  darfEntscheiden: boolean,
): Tauschrechte {
  return {
    canRespond: status === "offen" && beteiligte.targetId === userId,
    canDecide: status === "angenommen" && darfEntscheiden,
    canWithdraw: (status === "offen" || status === "angenommen") && beteiligte.requesterId === userId,
  };
}

/** Ist der Bestellschluss vorbei? Gleichstand zählt als vorbei. */
export function stichtagVorbei(deadline: Date, now: Date = new Date()): boolean {
  return deadline <= now;
}
