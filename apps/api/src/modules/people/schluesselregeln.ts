/**
 * Regeln der Schlüsselfunktionen als reine Funktionen.
 *
 * Wer heute zuständig ist, wer bei einer Abwesenheit informiert wird und wann
 * eine Stufe geleert werden darf, ergibt sich vollständig aus den Eingaben und
 * gehört nicht zwischen Datenbankabfragen.
 */
import { SCHLUESSEL_STUFEN, type SchluesselAmpel } from "@ah-intranet/shared";

/** Konten je Stufe (Index = Stufe), `null` = nicht besetzt. */
export type Stufen = readonly (string | null)[];

function stufenName(stufe: number): string {
  return SCHLUESSEL_STUFEN.find((eintrag) => eintrag.stufe === stufe)?.name ?? `Stufe ${stufe}`;
}

export interface WirksamEingabe {
  stufen: Stufen;
  /** Konten, die aktiv sind, sich anmelden können und das nötige Recht tragen. */
  gueltig: ReadonlySet<string>;
  /** Konten, die heute ganztägig abwesend sind. */
  abwesend: ReadonlySet<string>;
}

/** Erste Stufe, deren Konto gültig und anwesend ist - sonst `null`: dann gehört der Fall der Geschäftsführung. */
export function zustaendig({ stufen, gueltig, abwesend }: WirksamEingabe): { userId: string; stufe: number } | null {
  for (let stufe = 0; stufe < stufen.length; stufe += 1) {
    const userId = stufen[stufe];
    if (userId && gueltig.has(userId) && !abwesend.has(userId)) {
      return { userId, stufe };
    }
  }
  return null;
}

/**
 * Ampel einer Funktion: grün, wenn alle drei Stufen gültig besetzt sind; gelb
 * bei mindestens zwei gültigen (Key User und ein Vertreter, oder zwei Vertreter);
 * sonst rot. Die Mindestbesetzung von zwei ist der Kern der Anforderung.
 */
export function ampel(stufen: Stufen, gueltig: ReadonlySet<string>): SchluesselAmpel {
  const zahl = stufen.filter((userId) => userId && gueltig.has(userId)).length;
  if (zahl >= SCHLUESSEL_STUFEN.length) {
    return "gruen";
  }
  return zahl >= 2 ? "gelb" : "rot";
}

/**
 * Darf eine Stufe geleert werden?
 *
 * Eine Funktion fällt nie unter zwei gültige Träger - es sei denn, sie lag
 * schon darunter: dann darf man eine ungültige Stufe aufräumen, ohne dass die
 * Aufräumarbeit an der Sperre scheitert.
 */
export function darfLeeren(eingabe: { gueltigVorher: number; gueltigNachher: number }): boolean {
  return eingabe.gueltigNachher >= 2 || eingabe.gueltigNachher >= eingabe.gueltigVorher;
}

export interface MeldungsEingabe {
  stufen: Stufen;
  /** Die Person, die fehlt. */
  abwesenderId: string;
  gueltig: ReadonlySet<string>;
  /** Heute abwesende Konten, einschließlich der fehlenden Person. */
  abwesend: ReadonlySet<string>;
  /** Konten, die die Eskalation erhalten (Geschäftsführung). */
  eskalation: readonly string[];
}

export interface Empfaenger {
  userId: string;
  /** Was der Empfänger in dieser Funktion ist. */
  rolle: string;
}

/**
 * Wer über die Abwesenheit eines Funktionsträgers informiert wird.
 *
 * Alle anderen gültigen und anwesenden Träger der Funktion - Key User und
 * Vertreter wollen wissen, dass sie gebraucht werden. Ist keiner von ihnen
 * erreichbar, geht die Meldung an die Geschäftsführung: sonst bliebe die
 * Funktion unbemerkt unbesetzt.
 */
export function empfaengerBeiAbwesenheit({
  stufen,
  abwesenderId,
  gueltig,
  abwesend,
  eskalation,
}: MeldungsEingabe): Empfaenger[] {
  const kollegen: Empfaenger[] = stufen.flatMap((userId, stufe) =>
    userId && userId !== abwesenderId && gueltig.has(userId) && !abwesend.has(userId)
      ? [{ userId, rolle: stufenName(stufe) }]
      : [],
  );
  if (kollegen.length > 0) {
    return kollegen;
  }
  return eskalation
    .filter((userId) => userId !== abwesenderId && !abwesend.has(userId))
    .map((userId) => ({ userId, rolle: "Geschäftsführung" }));
}

export interface AbwesenheitsZeitraum {
  von: Date;
  bis: Date;
  startHalb: boolean;
  endHalb: boolean;
}

/**
 * Ist die Person an dem Tag ganztägig weg?
 *
 * Ein halber Tag am Rand zählt als anwesend: wer mittags geht, ist morgens
 * erreichbar. Ein Einzeltag mit Halbtag ist ebenfalls keine Abwesenheit.
 */
export function ganztaegigAbwesend(zeitraum: AbwesenheitsZeitraum, heute: Date): boolean {
  const tag = Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate());
  const von = Date.UTC(zeitraum.von.getUTCFullYear(), zeitraum.von.getUTCMonth(), zeitraum.von.getUTCDate());
  const bis = Date.UTC(zeitraum.bis.getUTCFullYear(), zeitraum.bis.getUTCMonth(), zeitraum.bis.getUTCDate());
  if (tag < von || tag > bis) {
    return false;
  }
  if (von === bis) {
    return !(zeitraum.startHalb || zeitraum.endHalb);
  }
  if (tag === von && zeitraum.startHalb) {
    return false;
  }
  if (tag === bis && zeitraum.endHalb) {
    return false;
  }
  return true;
}

export interface AusfallFunktion {
  key: string;
  name: string;
  stufen: Stufen;
  /** Gültige Träger **nach** dem Ausfall. Der ausgefallene Träger gehört nicht mehr dazu. */
  gueltigNachher: ReadonlySet<string>;
}

export interface AusfallZeile {
  funktion: string;
  /** Stufen, die der ausgefallene Träger gehalten hat und die jetzt nicht mehr besetzt sind. */
  freigewordeneStufen: string[];
  /** Wie viele Stufen der Funktion danach noch gültig besetzt sind. */
  verbleibend: number;
  /** Unter der Mindestbesetzung von zwei. */
  unterbesetzt: boolean;
}

/** Was der Ausfall eines Trägers je Funktion bedeutet. Funktionen, in denen er nichts hielt, fehlen. */
export function ausfallZeilen(traegerId: string, funktionen: readonly AusfallFunktion[]): AusfallZeile[] {
  return funktionen.flatMap((funktion) => {
    const frei = funktion.stufen.flatMap((userId, stufe) => (userId === traegerId ? [stufenName(stufe)] : []));
    if (frei.length === 0) {
      return [];
    }
    const verbleibend = funktion.stufen.filter(
      (userId) => userId && userId !== traegerId && funktion.gueltigNachher.has(userId),
    ).length;
    return [{ funktion: funktion.name, freigewordeneStufen: frei, verbleibend, unterbesetzt: verbleibend < 2 }];
  });
}

export interface AusfallEmpfaenger {
  userId: string;
  /** Funktionen, derentwegen dieser Empfänger die Meldung bekommt. */
  funktionen: string[];
}

/**
 * Wer über den Ausfall informiert wird.
 *
 * Die anderen gültigen Träger jeder betroffenen Funktion - egal ob sie heute da
 * sind, denn es geht um die Besetzung, nicht um den Tag - und immer die
 * Geschäftsführung: sie trägt die Verantwortung, wenn eine Funktion dünn wird.
 */
export function ausfallEmpfaenger({
  traegerId,
  funktionen,
  eskalation,
}: {
  traegerId: string;
  funktionen: readonly AusfallFunktion[];
  eskalation: readonly string[];
}): AusfallEmpfaenger[] {
  const betroffen = funktionen.filter((funktion) => funktion.stufen.includes(traegerId));
  const proPerson = new Map<string, string[]>();
  const merke = (userId: string, funktion: string) => {
    if (userId === traegerId) {
      return;
    }
    const liste = proPerson.get(userId) ?? [];
    if (!liste.includes(funktion)) {
      liste.push(funktion);
    }
    proPerson.set(userId, liste);
  };

  for (const funktion of betroffen) {
    for (const userId of funktion.stufen) {
      if (userId && funktion.gueltigNachher.has(userId)) {
        merke(userId, funktion.name);
      }
    }
    for (const userId of eskalation) {
      merke(userId, funktion.name);
    }
  }
  return [...proPerson].map(([userId, namen]) => ({ userId, funktionen: namen }));
}
