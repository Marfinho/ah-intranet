/** Rasterbildtypen, die als Logo zulässig sind. */
export type Bildtyp = "image/png" | "image/jpeg" | "image/webp";

/**
 * Erkennt den Bildtyp am Dateikopf (Magic Bytes), nicht an dem, was der Browser
 * behauptet. `file.mimetype` ist eine Angabe des Absenders: eine HTML-Datei mit
 * der Endung `.png` käme damit durch, und ein Browser, der den Inhalt später
 * selbst deutet, führte sie aus.
 */
export function erkenneBildtyp(daten: Buffer): Bildtyp | null {
  if (daten.length >= 8 && daten.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (daten.length >= 3 && daten[0] === 0xff && daten[1] === 0xd8 && daten[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    daten.length >= 12 &&
    daten.subarray(0, 4).toString("ascii") === "RIFF" &&
    daten.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
