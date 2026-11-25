/**
 * Liest aus dem Text einer `schema.prisma`, welche Felder Beziehungen sind und auf
 * welcher Seite der Fremdschlüssel liegt.
 *
 * Warum es das gibt: Die Mandantentrennung (`tenant-isolation.ts`) muss beim
 * Anlegen wissen, ob ein Datensatz in Prismas geprüfter Schreibweise
 * (`author: { connect }`) oder mit skalaren Fremdschlüsseln (`authorId`) geschrieben
 * wird - beides zugleich verbietet Prisma. Bis Prisma 6 stand das in
 * `Prisma.dmmf`; Prisma 7 liefert es zur Laufzeit nicht mehr, und die
 * eingebettete Kurzfassung des Datenmodells lässt die Fremdschlüssel weg.
 *
 * Rein und deshalb in `src` und getestet; geschrieben wird die Datei von
 * `prisma/modell-meta.ts` als Teil von `prisma:generate`.
 */
export interface BeziehungMeta {
  /** Modell auf der Gegenseite. */
  target: string;
  /** Der Fremdschlüssel liegt auf diesem Modell (`@relation(fields: [...])`). */
  owned: boolean;
}

export type ModellMeta = Record<string, Record<string, BeziehungMeta>>;

export function leseModellMeta(schema: string): ModellMeta {
  const bloecke = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const modelle = new Set(bloecke.map((treffer) => treffer[1]!));
  const ergebnis: ModellMeta = {};

  for (const [, name, koerper] of bloecke) {
    const beziehungen: Record<string, BeziehungMeta> = {};
    for (const zeile of koerper!.split("\n")) {
      // `feld  Typ[]?  @attribute ...` - Kommentare und Attribute auf Modellebene fallen heraus.
      const treffer = /^\s*(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/.exec(zeile.replace(/\/\/.*$/, ""));
      if (!treffer || !modelle.has(treffer[2]!)) {
        continue;
      }
      const [, feld, ziel, , , rest] = treffer;
      beziehungen[feld!] = { target: ziel!, owned: /@relation\([^)]*fields:\s*\[/.test(rest ?? "") };
    }
    ergebnis[name!] = beziehungen;
  }
  return ergebnis;
}
