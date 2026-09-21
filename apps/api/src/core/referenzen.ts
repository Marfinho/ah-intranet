import { BadRequestException } from "@nestjs/common";

/**
 * Prüft Fremdschlüssel aus Anfragedaten gegen den eigenen Mandanten.
 *
 * **Warum das nötig ist.** Die Prisma-Middleware filtert die oberste Operation
 * einer Abfrage. Eine über `include` mitgeladene Beziehung folgt dagegen ihrem
 * Fremdschlüssel ungefiltert, und `stampTenant` lässt `connect` bewusst
 * unberührt. Solange kein Fremdschlüssel aus Anfragedaten ungeprüft in `data`
 * landet, trägt das. Landet doch einer - etwa eine `locationId` aus einem
 * fremden Haus -, liefert der nächste Lesezugriff den Namen dieses fremden
 * Standorts mit aus.
 *
 * Die Prüfung schlägt den Wert deshalb über den **gefilterten** Client nach:
 * gehört er nicht zum Haus, findet sie nichts. Sie ersetzt keine fachliche
 * Prüfung (ob ein Raum frei oder ein Konto aktiv ist) - sie stellt nur die
 * Mandantengrenze wieder her, die der Fremdschlüssel sonst durchlässt.
 */
export interface Findbar {
  findFirst(args: { where: Record<string, unknown>; select: { id: true } }): Promise<{ id: string } | null>;
}

export interface Referenzpruefung {
  /** Das Prisma-Modell, über den gefilterten Client. */
  modell: Findbar;
  /** Der zu prüfende Wert. `null` und `undefined` sind zulässig und werden übersprungen. */
  id: string | null | undefined;
  /** Bezeichnung für die Fehlermeldung, z. B. "Der Standort". */
  bezeichnung: string;
  /** Zusätzliche Bedingungen, etwa `{ status: "active" }`. */
  zusatz?: Record<string, unknown>;
}

/**
 * Bewusst dieselbe Meldung für "gibt es nicht" und "gehört einem anderen Haus".
 * Eine Unterscheidung wäre ein Orakel, mit dem sich fremde Datensätze erraten
 * ließen.
 */
export async function pruefeReferenz(pruefung: Referenzpruefung): Promise<void> {
  if (!pruefung.id) {
    return;
  }

  const treffer = await pruefung.modell.findFirst({
    where: { id: pruefung.id, ...(pruefung.zusatz ?? {}) },
    select: { id: true },
  });

  if (!treffer) {
    throw new BadRequestException(`${pruefung.bezeichnung} ist in diesem Autohaus nicht vorhanden.`);
  }
}

/** Mehrere Fremdschlüssel in einem Rutsch; die erste Abweichung entscheidet. */
export async function pruefeReferenzen(pruefungen: Referenzpruefung[]): Promise<void> {
  for (const pruefung of pruefungen) {
    await pruefeReferenz(pruefung);
  }
}
