import { MODULE_DEFINITIONS } from "@ah-intranet/shared";

/**
 * Reine Rechenregeln der Verwaltung. Zwischen SQL-Abfragen versteckt wären sie
 * nur mit laufender Datenbank prüfbar - hier hängen sie an Eingaben und Tests.
 */

/** Anteil in Prozent, auf eine Nachkommastelle; `null`, wenn es keine Bezugsgröße gibt. */
export function anteil(teil: number, gesamt: number): number | null {
  if (gesamt <= 0) return null;
  return Math.round((teil / gesamt) * 1000) / 10;
}

/** Belegte Lizenzen in Prozent. Ohne Kontingent (unbegrenzt) gibt es keine Auslastung. */
export function lizenzAuslastung(aktiv: number, lizenzen: number | null): number | null {
  return lizenzen === null ? null : anteil(aktiv, lizenzen);
}

/** Welche Module ein Haus eingeschaltet hat: gespeicherte Zeilen, sonst die Vorgabe der Registry. */
export function aktiveModule(zeilen: { key: string; enabled: boolean }[]): string[] {
  const gesetzt = new Map(zeilen.map((zeile) => [zeile.key, zeile.enabled]));
  return MODULE_DEFINITIONS.filter((modul) => modul.core || (gesetzt.get(modul.key) ?? modul.defaultEnabled)).map(
    (modul) => modul.key,
  );
}

/**
 * Was beim Umschalten eines Moduls mitgeschaltet wird - dieselbe Regel wie im
 * Kundendienst (`ModuleRegistryService.setEnabled`): Einschalten zieht
 * Vormodule nach, Ausschalten nimmt abhängige mit.
 */
export function modulAenderung(key: string, einschalten: boolean): Map<string, boolean> {
  const betroffen = new Map<string, boolean>([[key, einschalten]]);
  const definition = MODULE_DEFINITIONS.find((modul) => modul.key === key);
  if (!definition) return betroffen;

  if (einschalten) {
    for (const vorgaenger of definition.dependsOn as readonly string[]) betroffen.set(vorgaenger, true);
    return betroffen;
  }
  const warteschlange = [key];
  while (warteschlange.length > 0) {
    const aktuell = warteschlange.shift()!;
    for (const modul of MODULE_DEFINITIONS) {
      if ((modul.dependsOn as readonly string[]).includes(aktuell) && !modul.core && !betroffen.has(modul.key)) {
        betroffen.set(modul.key, false);
        warteschlange.push(modul.key);
      }
    }
  }
  return betroffen;
}

/** Füllt Tage ohne Eintrag mit 0 auf, damit eine Reihe lückenlos ist. */
export function fuelleTage(
  reihe: { tag: string; n: number }[],
  tage: number,
  heute: Date = new Date(),
): { tag: string; n: number }[] {
  const nachTag = new Map(reihe.map((eintrag) => [eintrag.tag, eintrag.n]));
  const ergebnis: { tag: string; n: number }[] = [];
  for (let zurueck = tage - 1; zurueck >= 0; zurueck--) {
    const tag = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate() - zurueck))
      .toISOString()
      .slice(0, 10);
    ergebnis.push({ tag, n: nachTag.get(tag) ?? 0 });
  }
  return ergebnis;
}

export type Stufe = "kritisch" | "warnung" | "info";

export interface Hinweis {
  stufe: Stufe;
  haus?: { id: string; name: string };
  interessent?: { id: string; name: string };
  text: string;
}

export interface HausKennzahlen {
  id: string;
  name: string;
  isActive: boolean;
  aktiveKonten: number;
  licensedSeats: number | null;
  locationLimit: number | null;
  standorte: number;
  letzteAnmeldung: Date | null;
  mfaPflicht: boolean;
  createdAt: Date;
}

const TAG_MS = 86_400_000;

/**
 * Was dem Betreiber auffallen sollte. Schwellen stehen hier und nirgends sonst:
 * ein Hinweis, der bei jedem Haus anspringt, wird überlesen.
 */
export function hausHinweise(haus: HausKennzahlen, jetzt: Date = new Date()): Hinweis[] {
  const hinweise: Hinweis[] = [];
  const ref = { id: haus.id, name: haus.name };
  if (!haus.isActive) {
    hinweise.push({ stufe: "info", haus: ref, text: "Haus ist gesperrt" });
    return hinweise;
  }
  const auslastung = lizenzAuslastung(haus.aktiveKonten, haus.licensedSeats);
  if (auslastung !== null && auslastung >= 100) {
    hinweise.push({
      stufe: "kritisch",
      haus: ref,
      text: `Lizenzkontingent erschöpft (${haus.aktiveKonten}/${haus.licensedSeats})`,
    });
  } else if (auslastung !== null && auslastung >= 90) {
    hinweise.push({ stufe: "warnung", haus: ref, text: `Lizenzkontingent zu ${auslastung} % belegt` });
  }
  if (haus.locationLimit !== null && haus.standorte >= haus.locationLimit) {
    hinweise.push({
      stufe: "warnung",
      haus: ref,
      text: `Standortlimit erreicht (${haus.standorte}/${haus.locationLimit})`,
    });
  }
  const alterTage = (jetzt.getTime() - haus.createdAt.getTime()) / TAG_MS;
  if (haus.letzteAnmeldung === null) {
    if (alterTage > 7)
      hinweise.push({ stufe: "warnung", haus: ref, text: "Seit der Anlage hat sich noch niemand angemeldet" });
  } else if ((jetzt.getTime() - haus.letzteAnmeldung.getTime()) / TAG_MS > 30) {
    hinweise.push({ stufe: "warnung", haus: ref, text: "Seit über 30 Tagen keine Anmeldung" });
  }
  return hinweise;
}

export interface LeadKurz {
  id: string;
  name: string;
  status: string;
  angefragtAm: Date | null;
  updatedAt: Date;
  tokenGueltigBis: Date;
  tokenWiderrufenAm: Date | null;
}

export function leadHinweise(lead: LeadKurz, jetzt: Date = new Date()): Hinweis[] {
  const ref = { id: lead.id, name: lead.name };
  const hinweise: Hinweis[] = [];
  if (lead.status === "angefragt" && lead.angefragtAm && (jetzt.getTime() - lead.angefragtAm.getTime()) / TAG_MS > 3) {
    hinweise.push({ stufe: "kritisch", interessent: ref, text: "Anfrage seit über 3 Tagen unbearbeitet" });
  }
  const offen = lead.status === "entwurf" || lead.status === "versendet";
  const tageBisAblauf = (lead.tokenGueltigBis.getTime() - jetzt.getTime()) / TAG_MS;
  if (offen && !lead.tokenWiderrufenAm && tageBisAblauf > 0 && tageBisAblauf <= 7) {
    hinweise.push({ stufe: "warnung", interessent: ref, text: `Link läuft in ${Math.ceil(tageBisAblauf)} Tag(en) ab` });
  }
  return hinweise;
}

export interface TrichterStufe {
  status: string;
  anzahl: number;
}

/** Abschlussquote: gewonnen von allen entschiedenen (gewonnen + verloren). */
export function abschlussquote(stufen: TrichterStufe[]): number | null {
  const anzahl = (status: string) => stufen.find((stufe) => stufe.status === status)?.anzahl ?? 0;
  return anteil(anzahl("gewonnen"), anzahl("gewonnen") + anzahl("verloren"));
}

const RANG = { kritisch: 0, warnung: 1, info: 2 } as const;
export function sortiereHinweise(hinweise: Hinweis[]): Hinweis[] {
  return [...hinweise].sort((a, b) => RANG[a.stufe] - RANG[b.stufe]);
}
