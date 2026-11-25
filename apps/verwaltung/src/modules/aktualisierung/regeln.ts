/**
 * Regeln der Aktualisierung als reine Funktionen: was darf angefordert werden,
 * und was fällt an einer Änderung auf. Zwischen HTTP-Aufrufen versteckt wären
 * sie nur mit Netzzugang prüfbar - und ein falsches „grün“ installiert Fehler.
 */

export const SHA_MUSTER = /^[0-9a-f]{40}$/;
export const kurz = (sha: string | null | undefined): string => (sha ? sha.slice(0, 7) : "–");

export type CiZustand = "gruen" | "rot" | "laeuft" | "unbekannt";

export interface Pruefung {
  name: string;
  status: string; // queued | in_progress | completed
  conclusion?: string | null;
}

/**
 * Gesamtzustand der Prüfungen eines Stands. Eine einzige rote genügt für „rot“,
 * eine laufende macht es unentschieden; ohne Prüfungen heißt es „unbekannt“ und
 * zählt **nicht** als grün: wo nichts geprüft wurde, ist nichts bewiesen.
 */
export function ciZustand(pruefungen: readonly Pruefung[]): CiZustand {
  if (pruefungen.length === 0) return "unbekannt";
  const rot = new Set(["failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"]);
  if (pruefungen.some((p) => p.status === "completed" && p.conclusion && rot.has(p.conclusion))) return "rot";
  if (pruefungen.some((p) => p.status !== "completed")) return "laeuft";
  return "gruen";
}

export type Vergleich = "identical" | "ahead" | "behind" | "diverged";

export interface Bewertung {
  darfAnfordern: boolean;
  gruende: string[];
}

/**
 * Darf der Stand `ziel` installiert werden? Alle Bedingungen müssen stimmen;
 * jede, die nicht stimmt, steht mit Grund in der Antwort - die Oberfläche
 * erklärt, warum der Knopf aus ist, statt ihn stumm zu sperren.
 */
export function bewerteAnforderung(eingabe: {
  installiert: string | null;
  ziel: string;
  /** Ziel gegenüber dem Installierten: `ahead` heißt, das Ziel ist neuer. */
  zielGegenInstalliert: Vergleich | null;
  /** Liegt das Ziel auf `main`? (Ziel ist Vorfahre des Kopfes oder gleich.) */
  zielAufMain: boolean;
  ci: CiZustand;
  aktiverAuftrag: boolean;
  aktualisiererLebt: boolean;
}): Bewertung {
  const gruende: string[] = [];
  if (!SHA_MUSTER.test(eingabe.ziel)) gruende.push("Der Zielstand ist keine gültige Commit-Kennung.");
  if (!eingabe.installiert) {
    gruende.push(
      "Der Aktualisierer hat noch keinen installierten Stand gemeldet (läuft er? siehe docs/verwaltung.md).",
    );
  } else if (eingabe.installiert === eingabe.ziel || eingabe.zielGegenInstalliert === "identical") {
    gruende.push("Dieser Stand ist bereits installiert.");
  } else if (eingabe.zielGegenInstalliert !== "ahead") {
    // `behind`/`diverged`: ein älterer oder fremder Stand. Zurückgehen ist kein Update, sondern ein Eingriff.
    gruende.push(
      "Der Zielstand ist nicht neuer als der installierte. Zurückgehen geht nur von Hand (docs/verwaltung.md).",
    );
  }
  if (!eingabe.zielAufMain) gruende.push("Der Zielstand liegt nicht auf dem Hauptzweig.");
  if (eingabe.ci === "rot") gruende.push("Die Prüfpipeline dieses Stands ist rot.");
  if (eingabe.ci === "laeuft") gruende.push("Die Prüfpipeline dieses Stands läuft noch.");
  if (eingabe.ci === "unbekannt")
    gruende.push("Für diesen Stand liegt keine Prüfung vor - ohne Beweis kein Einspielen.");
  if (eingabe.aktiverAuftrag) gruende.push("Es läuft oder wartet bereits ein Auftrag.");
  if (!eingabe.aktualisiererLebt)
    gruende.push("Der Aktualisierer auf dem Server meldet sich nicht - ein Auftrag bliebe liegen.");
  return { darfAnfordern: gruende.length === 0, gruende };
}

/** Der Aktualisierer meldet sich jede Minute; drei Minuten Stille gelten als ausgefallen. */
export function aktualisiererLebt(zuletztGesehen: Date | null, jetzt: Date = new Date()): boolean {
  return zuletztGesehen !== null && jetzt.getTime() - zuletztGesehen.getTime() < 3 * 60_000;
}

export interface Datei {
  filename: string;
  status?: string;
}

export interface Auswirkung {
  art: "migration" | "rolle" | "abhaengigkeiten" | "konfiguration" | "proxy";
  text: string;
}

/** Was ein Update neben dem Code verändert - damit niemand überrascht wird. */
export function auswirkungen(dateien: readonly Datei[]): Auswirkung[] {
  const namen = dateien.map((datei) => datei.filename);
  const treffer = (muster: RegExp) => namen.some((name) => muster.test(name));
  const liste: Auswirkung[] = [];
  const migrationen = namen.filter((name) =>
    /^apps\/(api|verwaltung)\/prisma\/migrations\/.+\/migration\.sql$/.test(name),
  );
  if (migrationen.length > 0) {
    liste.push({
      art: "migration",
      text: `${migrationen.length} Datenbankmigration(en) - laufen beim Start, nur vorwärts. Vorher wird eine Sicherung gemacht; bei einem Fehler lässt sich die Datenbank nicht automatisch zurücksetzen.`,
    });
  }
  if (treffer(/^scripts\/verwaltung-rolle\.sql$/)) {
    liste.push({
      art: "rolle",
      text: "Die Datenbankrolle der Verwaltung ändert sich - der Aktualisierer spielt sie automatisch ein.",
    });
  }
  if (treffer(/^pnpm-lock\.yaml$/))
    liste.push({
      art: "abhaengigkeiten",
      text: "Abhängigkeiten ändern sich - die Images werden neu gebaut (dauert länger).",
    });
  if (treffer(/^docker-compose.*\.yml$/))
    liste.push({
      art: "konfiguration",
      text: "Die Compose-Datei ändert sich - Dienste werden ggf. neu angelegt. Neue Einstellungen in der .env prüfen.",
    });
  if (treffer(/^Caddyfile/)) liste.push({ art: "proxy", text: "Die Proxy-Konfiguration ändert sich." });
  return liste;
}

/** Welche Images bei diesem Update neu gebaut werden müssen. */
export function zuBauen(dateien: readonly Datei[]): { api: boolean; web: boolean; verwaltung: boolean } {
  const namen = dateien.map((datei) => datei.filename);
  const gemeinsam = (name: string) => /^(packages\/|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|package\.json$)/.test(name);
  const hat = (praefix: string) => namen.some((name) => name.startsWith(praefix) || gemeinsam(name));
  return { api: hat("apps/api/"), web: hat("apps/web/"), verwaltung: hat("apps/verwaltung/") };
}
