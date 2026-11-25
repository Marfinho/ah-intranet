/**
 * Zeitrechnung in Ortszeit (Europe/Berlin) - geteilt zwischen API und Browser.
 *
 * Browser und Server müssen dieselbe Ortszeit rechnen, sonst verschöbe das
 * Ziehen einer Schicht im Plan sie um eine Stunde, sobald der Rechner des
 * Nutzers in einer anderen Zeitzone steht oder die Sommerzeit wechselt.
 */

const ZONE = "Europe/Berlin";
const MINUTE = 60_000;

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

export function tagVerschieben(datum: string, tage: number): string {
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

/** Minuten seit Mitternacht in Ortszeit. */
export function lokaleMinuten(zeitpunkt: Date): number {
  const [stunde, minute] = lokaleUhrzeit(zeitpunkt).split(":").map(Number);
  return stunde * 60 + minute;
}
