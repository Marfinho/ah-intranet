import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, isPermissionKey } from "@ah-intranet/shared";

/**
 * Hält den Code gegen die Registry.
 *
 * Ein Recht ist nur so gut wie seine Schreibweise: `@Permission("order.approve")`
 * statt `orders.approve` prüft ein Recht, das niemand vergeben kann - die Route
 * wäre für alle gesperrt, und nichts würde auffallen. Umgekehrt ist ein Recht,
 * das keine Stelle im Code prüft, ein Schalter ohne Leitung.
 */
function dateien(verzeichnis: string): string[] {
  return readdirSync(verzeichnis).flatMap((eintrag) => {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) {
      return dateien(pfad);
    }
    return pfad.endsWith(".ts") && !pfad.endsWith(".test.ts") ? [pfad] : [];
  });
}

const QUELLEN = dateien(join(__dirname, "..")).map((pfad) => ({ pfad, inhalt: readFileSync(pfad, "utf-8") }));

/** Jede Stelle, an der der Code ein Recht benennt. */
function verwendeteRechte(): { recht: string; pfad: string }[] {
  const muster = [/@Permission\("([^"]+)"\)/g, /can\(user, "([^"]+)"\)/g, /permissionName\("([^"]+)"\)/g];
  return QUELLEN.flatMap(({ pfad, inhalt }) =>
    muster.flatMap((regex) => [...inhalt.matchAll(regex)].map((treffer) => ({ recht: treffer[1], pfad }))),
  );
}

describe("Rechte im Code", () => {
  it("benennt nur Rechte, die es in der Registry gibt", () => {
    const unbekannt = verwendeteRechte().filter((eintrag) => !isPermissionKey(eintrag.recht));
    expect(unbekannt.map((eintrag) => `${eintrag.recht} in ${eintrag.pfad}`)).toEqual([]);
  });

  it("lässt kein Recht ohne prüfende Stelle", () => {
    const benutzt = new Set(verwendeteRechte().map((eintrag) => eintrag.recht));
    expect(PERMISSION_KEYS.filter((recht) => !benutzt.has(recht))).toEqual([]);
  });

  it("kennt keine Rollenschranke mehr", () => {
    // Rollenschlüssel im Code wären genau die Sperre, die eigene Rollen des
    // Hauses aussperrt: sie kämen an keiner solchen Prüfung vorbei.
    const mitSchranke = QUELLEN.filter(({ inhalt }) => /@Roles\(/.test(inhalt));
    expect(mitSchranke.map((eintrag) => eintrag.pfad)).toEqual([]);
  });
});
