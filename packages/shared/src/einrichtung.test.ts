import { describe, expect, it } from "vitest";
import {
  EINRICHTUNG_SCHRITTE,
  berechneFortschritt,
  ermittleEinrichtungsVariante,
  pflichtschritteErledigt,
  type EinrichtungsSchrittStatus,
} from "./einrichtung";

describe("Ableitung der Einrichtungs-Variante aus Rechten", () => {
  it("erkennt die volle Verwaltungshoheit als gruppenadmin", () => {
    expect(ermittleEinrichtungsVariante(["users.manage", "roles.manage"])).toBe("gruppenadmin");
  });

  it("verlangt beide Rechte gemeinsam für gruppenadmin", () => {
    expect(ermittleEinrichtungsVariante(["users.manage"])).not.toBe("gruppenadmin");
    expect(ermittleEinrichtungsVariante(["roles.manage"])).not.toBe("gruppenadmin");
  });

  it("erkennt ein einzelnes Führungsrecht als standortleitung", () => {
    expect(ermittleEinrichtungsVariante(["absences.approve"])).toBe("standortleitung");
    expect(ermittleEinrichtungsVariante(["orders.approve"])).toBe("standortleitung");
    expect(ermittleEinrichtungsVariante(["tickets.manage"])).toBe("standortleitung");
  });

  it("fällt ohne besondere Rechte auf mitarbeiter zurück", () => {
    expect(ermittleEinrichtungsVariante([])).toBe("mitarbeiter");
    expect(ermittleEinrichtungsVariante(["news.publish"])).toBe("mitarbeiter");
  });

  it("bevorzugt gruppenadmin, auch wenn zusätzlich ein Führungsrecht vorliegt", () => {
    expect(ermittleEinrichtungsVariante(["users.manage", "roles.manage", "orders.approve"])).toBe("gruppenadmin");
  });
});

describe("Schrittdefinitionen je Variante", () => {
  it("vergibt in jeder Variante jede Schritt-ID nur einmal", () => {
    for (const variante of Object.keys(EINRICHTUNG_SCHRITTE) as (keyof typeof EINRICHTUNG_SCHRITTE)[]) {
      const ids = EINRICHTUNG_SCHRITTE[variante].map((schritt) => schritt.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("beginnt jede Zielseite mit einem Schrägstrich", () => {
    for (const schritte of Object.values(EINRICHTUNG_SCHRITTE)) {
      for (const schritt of schritte) {
        expect(schritt.href.startsWith("/")).toBe(true);
      }
    }
  });

  it("hat für die gruppenadmin-Variante mehr Pflichtschritte als die mitarbeiter-Variante", () => {
    const pflichtGruppenadmin = EINRICHTUNG_SCHRITTE.gruppenadmin.filter((schritt) => schritt.pflicht).length;
    const pflichtMitarbeiter = EINRICHTUNG_SCHRITTE.mitarbeiter.filter((schritt) => schritt.pflicht).length;
    expect(pflichtGruppenadmin).toBeGreaterThan(pflichtMitarbeiter);
  });
});

describe("Fortschritt und Abschlusslogik", () => {
  const schritt = (id: string, pflicht: boolean, done: boolean): EinrichtungsSchrittStatus => ({
    id: id as EinrichtungsSchrittStatus["id"],
    titel: id,
    beschreibung: "",
    href: "/",
    reihenfolge: 0,
    pflicht,
    abschlussbedingung: "",
    done,
    completedAt: done ? "2026-01-01T00:00:00.000Z" : null,
  });

  it("zählt erledigte von allen Schritten", () => {
    const schritte = [schritt("a", true, true), schritt("b", false, false), schritt("c", true, true)];
    expect(berechneFortschritt(schritte)).toEqual({ erledigt: 2, gesamt: 3 });
  });

  it("gilt erst als abgeschlossen, wenn alle Pflichtschritte erledigt sind", () => {
    const unvollstaendig = [schritt("a", true, true), schritt("b", true, false)];
    expect(pflichtschritteErledigt(unvollstaendig)).toBe(false);

    const vollstaendig = [schritt("a", true, true), schritt("b", true, true), schritt("c", false, false)];
    expect(pflichtschritteErledigt(vollstaendig)).toBe(true);
  });

  it("gilt bei einer Variante ohne Pflichtschritte als sofort abgeschlossen", () => {
    expect(pflichtschritteErledigt([schritt("a", false, false)])).toBe(true);
  });
});
