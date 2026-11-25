import { MODULE_DEFINITIONS } from "@ah-intranet/shared";
import { pruefeKennung } from "../../core/kennung";

/**
 * Was aus den Angaben eines Interessenten beim Anlegen des Hauses wird.
 *
 * Reine Funktionen: die Vorschau in der Oberfläche und das Anlegen selbst
 * rechnen dasselbe, und was die Vorschau zeigt, entsteht auch.
 */

export interface StandortFuerHaus {
  name: string;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  marken: string[];
  leistungen: string[];
}

export interface HausPlan {
  standorte: { name: string; code: string; adresse: string | null; marken: string[]; abteilungen: string[] }[];
  marken: { name: string; code: string }[];
  abteilungen: { name: string; code: string }[];
}

/** Bekannte Leistungen bekommen die Kürzel, die auch die Zielgruppen verwenden (`department:SRV`). */
const ABTEILUNGSKUERZEL: Record<string, string> = {
  verkauf: "VKF",
  service: "SRV",
  werkstatt: "WST",
  teiledienst: "TLD",
  disposition: "DSP",
};

function ohneAkzente(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
}

/**
 * Kürzel aus einem Namen: bei mehreren Wörtern die Anfangsbuchstaben, bei einem
 * die ersten Buchstaben. Ist es vergeben, kommt eine Ziffer dazu - Kürzel müssen
 * im Haus eindeutig sein, weil Zielgruppen daran hängen.
 */
export function kuerzel(name: string, vergeben: Set<string>, laenge = 3): string {
  const woerter = ohneAkzente(name)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const roh = woerter.length > 1 ? woerter.map((wort) => wort[0]).join("") : (woerter[0] ?? "X").slice(0, laenge);
  const basis = roh.toUpperCase().slice(0, 6) || "X";

  let kandidat = basis;
  for (let zaehler = 2; vergeben.has(kandidat); zaehler += 1) {
    kandidat = `${basis}${zaehler}`;
  }
  vergeben.add(kandidat);
  return kandidat;
}

export function planeHaus(standorte: StandortFuerHaus[]): HausPlan {
  const standortNamen = new Set<string>();
  const standortCodes = new Set<string>();
  const markenCodes = new Set<string>();
  const abteilungsCodes = new Set<string>(["VWL"]);
  const marken = new Map<string, { name: string; code: string }>();
  const abteilungen = new Map<string, { name: string; code: string }>();

  const plan: HausPlan = {
    standorte: [],
    marken: [],
    abteilungen: [{ name: "Verwaltung", code: "VWL" }],
  };

  for (const standort of standorte) {
    let name = standort.name.trim();
    for (let zaehler = 2; standortNamen.has(name.toLowerCase()); zaehler += 1) {
      name = `${standort.name.trim()} (${zaehler})`;
    }
    standortNamen.add(name.toLowerCase());

    const markenDesStandorts: string[] = [];
    for (const rohe of standort.marken) {
      const markenName = rohe.trim();
      if (!markenName) continue;
      let marke = marken.get(markenName.toLowerCase());
      if (!marke) {
        marke = { name: markenName, code: kuerzel(markenName, markenCodes, 5) };
        marken.set(markenName.toLowerCase(), marke);
        plan.marken.push(marke);
      }
      markenDesStandorts.push(marke.code);
    }

    const abteilungenDesStandorts: string[] = [];
    for (const rohe of standort.leistungen) {
      const leistung = rohe.trim();
      if (!leistung) continue;
      let abteilung = abteilungen.get(leistung.toLowerCase());
      if (!abteilung) {
        const bekannt = ABTEILUNGSKUERZEL[leistung.toLowerCase()];
        const code = bekannt && !abteilungsCodes.has(bekannt) ? bekannt : kuerzel(leistung, abteilungsCodes);
        abteilungsCodes.add(code);
        abteilung = { name: leistung, code };
        abteilungen.set(leistung.toLowerCase(), abteilung);
        plan.abteilungen.push(abteilung);
      }
      abteilungenDesStandorts.push(abteilung.code);
    }

    plan.standorte.push({
      name,
      code: kuerzel(name, standortCodes, 3),
      adresse:
        [standort.strasse, [standort.plz, standort.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
      marken: [...new Set(markenDesStandorts)],
      abteilungen: [...new Set(abteilungenDesStandorts)],
    });
  }

  // Ohne Standort wäre das Haus unbenutzbar. Der erste trägt die Verwaltung,
  // dort sitzt das erste Administrationskonto.
  if (plan.standorte.length > 0) {
    plan.standorte[0].abteilungen = ["VWL", ...plan.standorte[0].abteilungen];
  }
  return plan;
}

/**
 * Modulzustand des neuen Hauses.
 *
 * Gewählte stabile Module sind an, alle anderen aus. Erprobungen bleiben aus,
 * auch im Tier Komplett: sie schaltet die Plattformverwaltung bewusst frei,
 * nicht ein Anlegeskript. Kernmodule haben keine Zeile.
 */
export function modulEinstellungen(gewaehlt: readonly string[]): { key: string; enabled: boolean }[] {
  return MODULE_DEFINITIONS.filter((modul) => !modul.core).map((modul) => ({
    key: modul.key,
    enabled: modul.stage === "stabil" && gewaehlt.includes(modul.key),
  }));
}

/** Schneidet ein Zeichen von beiden Enden ab, ohne Regex (kein Rückverfolgen bei langen Eingaben). */
function ohneRand(text: string, zeichen: string): string {
  let von = 0;
  let bis = text.length;
  while (von < bis && text[von] === zeichen) von++;
  while (bis > von && text[bis - 1] === zeichen) bis--;
  return text.slice(von, bis);
}

/** Vorschlag für die Kennung aus dem Namen; `null`, wenn daraus keine gültige wird. */
export function vorschlagKennung(name: string): string | null {
  const zusammen = ohneAkzente(name)
    .toLowerCase()
    .replace(/\b(gmbh|co|kg|ag|ug|gruppe|autohaus|autohaeuser|group)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-");
  const kennung = ohneRand(zusammen, "-");
  return kennung && !pruefeKennung(kennung) ? kennung : null;
}
