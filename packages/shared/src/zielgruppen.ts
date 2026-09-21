/**
 * Zielgruppen: Alle → Standort → Abteilung → Fachbereich.
 *
 * Eine Autohaus-Gruppe trägt mehrere Häuser auf einem Mandanten; ein Haus ist
 * ein **Standort**. Ein Aushang gilt deshalb entweder für die ganze Gruppe, für
 * ein Haus, für eine Abteilung – oder für einen Schnitt daraus: „Service in
 * Bremen" ist nicht dasselbe wie „Service überall" plus „Bremen komplett".
 *
 * Abgebildet wird das als flaches Token, nicht als Join-Kette:
 *
 *   global                          alle Mitarbeitenden der Gruppe
 *   location:HB                     ein Haus
 *   department:SRV                  eine Abteilung, in jedem Haus
 *   location:HB+department:SRV      der Schnitt: diese Abteilung in diesem Haus
 *
 * Der Schnitt kostet **keine** zusätzliche Abfrage: das Konto bringt seine
 * eigenen Kombinationen mit (`eigeneZielgruppen`), und die Sichtbarkeitsprüfung
 * bleibt ein einziges `hasSome` gegen den GIN-Index. Deshalb ist die Reihenfolge
 * der Teile fest - `department:SRV+location:HB` und `location:HB+department:SRV`
 * wären sonst zwei Tokens für dieselbe Zielgruppe, und eines davon träfe
 * niemanden.
 */

export const GLOBAL_SCOPE = "global";

/**
 * Die Stufen der Kaskade, von grob nach fein. Die Reihenfolge ist zugleich die
 * kanonische Reihenfolge der Teile in einem Token.
 */
export const ZIELGRUPPEN_STUFEN = ["location", "department", "specialty"] as const;

export type ZielgruppenStufe = (typeof ZIELGRUPPEN_STUFEN)[number];

export const ZIELGRUPPEN_STUFEN_LABELS: Record<ZielgruppenStufe, string> = {
  location: "Standort",
  department: "Abteilung",
  specialty: "Fachbereich",
};

/** Ein Token, zerlegt in seine Stufen. Leeres Objekt = `global`. */
export type Zielgruppe = Partial<Record<ZielgruppenStufe, string>>;

/** Ein wählbarer Eintrag einer Stufe, wie ihn die Oberfläche anbietet. */
export interface ZielgruppenEintrag {
  stufe: ZielgruppenStufe;
  code: string;
  name: string;
}

/** Was ein Mandant tatsächlich an Stammdaten hat - Grundlage jeder Prüfung. */
export interface ZielgruppenKatalog {
  eintraege: ZielgruppenEintrag[];
}

const TEIL = /^([a-z]+):([A-Za-z0-9_-]+)$/;

/** Baut das kanonische Token. Ohne Teile ist es `global`. */
export function zielgruppenToken(zielgruppe: Zielgruppe): string {
  const teile = ZIELGRUPPEN_STUFEN.filter((stufe) => zielgruppe[stufe]).map((stufe) => `${stufe}:${zielgruppe[stufe]}`);
  return teile.length ? teile.join("+") : GLOBAL_SCOPE;
}

/**
 * Zerlegt ein Token. `null` heißt: unbrauchbar - unbekannte Stufe, doppelte
 * Stufe, leerer Teil oder falsche Reihenfolge. Nicht erkannte Tokens werden
 * abgewiesen und nicht stillschweigend gespeichert: ein Aushang, der niemanden
 * erreicht, ist schlimmer als eine Fehlermeldung.
 */
export function parseZielgruppe(token: string): Zielgruppe | null {
  if (token === GLOBAL_SCOPE) {
    return {};
  }

  const zielgruppe: Zielgruppe = {};
  let zuletzt = -1;

  for (const teil of token.split("+")) {
    const treffer = TEIL.exec(teil);
    if (!treffer) {
      return null;
    }
    const stufe = treffer[1] as ZielgruppenStufe;
    const rang = (ZIELGRUPPEN_STUFEN as readonly string[]).indexOf(stufe);
    if (rang < 0 || rang <= zuletzt) {
      return null;
    }
    zielgruppe[stufe] = treffer[2];
    zuletzt = rang;
  }

  return zielgruppe;
}

/**
 * Die Tokens, unter denen ein Konto Inhalte sieht: `global`, jede einzelne
 * Stufe und jede Kombination daraus. Bei drei Stufen sind das höchstens acht
 * Tokens - klein genug für ein `hasSome`, und der Grund, warum der Schnitt
 * nichts kostet.
 */
export function eigeneZielgruppen(input: {
  locationCode?: string | null;
  departmentCode?: string | null;
  specialtyCode?: string | null;
}): string[] {
  const vorhanden: [ZielgruppenStufe, string][] = [];
  if (input.locationCode) vorhanden.push(["location", input.locationCode]);
  if (input.departmentCode) vorhanden.push(["department", input.departmentCode]);
  if (input.specialtyCode) vorhanden.push(["specialty", input.specialtyCode]);

  const tokens = [GLOBAL_SCOPE];
  // Jede nichtleere Teilmenge der eigenen Merkmale, als Bitmaske durchgezählt.
  for (let maske = 1; maske < 1 << vorhanden.length; maske++) {
    const zielgruppe: Zielgruppe = {};
    vorhanden.forEach(([stufe, code], index) => {
      if (maske & (1 << index)) {
        zielgruppe[stufe] = code;
      }
    });
    tokens.push(zielgruppenToken(zielgruppe));
  }
  return tokens;
}

/**
 * Prüft ein Token gegen die Stammdaten des Hauses. Ein Code, den es nicht gibt,
 * ist fast immer ein Tippfehler oder eine gelöschte Abteilung - beides darf
 * nicht als Zielgruppe durchgehen.
 */
export function istBekannteZielgruppe(token: string, katalog: ZielgruppenKatalog): boolean {
  const zielgruppe = parseZielgruppe(token);
  if (!zielgruppe) {
    return false;
  }
  return ZIELGRUPPEN_STUFEN.every((stufe) => {
    const code = zielgruppe[stufe];
    return !code || katalog.eintraege.some((eintrag) => eintrag.stufe === stufe && eintrag.code === code);
  });
}

/**
 * Klartext für die Anzeige: „Service & Werkstatt · Hauptbetrieb Bremen".
 * Unbekannte Codes erscheinen als Code - eine gelöschte Abteilung soll man am
 * Beitrag noch sehen, statt dass die Zeile leer bleibt.
 */
export function zielgruppeLabel(token: string, katalog: ZielgruppenKatalog): string {
  const zielgruppe = parseZielgruppe(token);
  if (!zielgruppe) {
    return token;
  }
  const teile = ZIELGRUPPEN_STUFEN.filter((stufe) => zielgruppe[stufe]).map((stufe) => {
    const code = zielgruppe[stufe]!;
    const eintrag = katalog.eintraege.find((e) => e.stufe === stufe && e.code === code);
    return eintrag ? eintrag.name : `${ZIELGRUPPEN_STUFEN_LABELS[stufe]} ${code}`;
  });
  return teile.length ? teile.join(" · ") : "Alle Mitarbeitenden";
}

/** Mehrere Tokens als ein Satz für die Anzeige. */
export function zielgruppenLabel(tokens: string[], katalog: ZielgruppenKatalog): string {
  if (!tokens.length || tokens.includes(GLOBAL_SCOPE)) {
    return "Alle Mitarbeitenden";
  }
  return tokens.map((token) => zielgruppeLabel(token, katalog)).join(" | ");
}
