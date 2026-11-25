import { describe, expect, it } from "vitest";
import { SCHLUESSELFUNKTIONEN, isPermissionKey } from "@ah-intranet/shared";
import { ampel, darfLeeren, empfaengerBeiAbwesenheit, ganztaegigAbwesend, zustaendig } from "./schluesselregeln";

const menge = (...ids: string[]) => new Set(ids);
const keine = new Set<string>();

describe("Registry der Schlüsselfunktionen", () => {
  it("bindet jede Funktion an ein Recht, das es gibt", () => {
    for (const funktion of SCHLUESSELFUNKTIONEN) {
      expect(isPermissionKey(funktion.recht), `${funktion.key} → ${funktion.recht}`).toBe(true);
    }
  });

  it("hat eindeutige Schlüssel", () => {
    const schluessel = SCHLUESSELFUNKTIONEN.map((funktion) => funktion.key);
    expect(new Set(schluessel).size).toBe(schluessel.length);
  });
});

describe("zustaendig", () => {
  const stufen = ["key", "v1", "v2"];

  it("ist zuerst der Key User", () => {
    expect(zustaendig({ stufen, gueltig: menge("key", "v1", "v2"), abwesend: keine })).toEqual({
      userId: "key",
      stufe: 0,
    });
  });

  it("geht bei Abwesenheit an den 1. Vertreter", () => {
    expect(zustaendig({ stufen, gueltig: menge("key", "v1", "v2"), abwesend: menge("key") })).toEqual({
      userId: "v1",
      stufe: 1,
    });
  });

  it("geht an den 2. Vertreter, wenn Key User und 1. Vertreter fehlen", () => {
    expect(zustaendig({ stufen, gueltig: menge("key", "v1", "v2"), abwesend: menge("key", "v1") })?.userId).toBe("v2");
  });

  it("ist niemand, wenn alle fehlen - dann gehört der Fall der Geschäftsführung", () => {
    expect(zustaendig({ stufen, gueltig: menge("key", "v1", "v2"), abwesend: menge("key", "v1", "v2") })).toBeNull();
  });

  it("überspringt ein ungültiges Konto, etwa ohne das nötige Recht", () => {
    expect(zustaendig({ stufen, gueltig: menge("v1", "v2"), abwesend: keine })?.userId).toBe("v1");
  });

  it("überspringt leere Stufen", () => {
    expect(
      zustaendig({ stufen: ["key", null, "v2"], gueltig: menge("key", "v2"), abwesend: menge("key") })?.userId,
    ).toBe("v2");
  });
});

describe("ampel", () => {
  it("ist grün bei drei gültigen Trägern", () => {
    expect(ampel(["a", "b", "c"], menge("a", "b", "c"))).toBe("gruen");
  });

  it("ist gelb bei zwei gültigen Trägern", () => {
    expect(ampel(["a", "b", null], menge("a", "b"))).toBe("gelb");
    expect(ampel(["a", "b", "c"], menge("a", "c"))).toBe("gelb");
  });

  it("ist rot unter zwei gültigen Trägern", () => {
    expect(ampel(["a", null, null], menge("a"))).toBe("rot");
    expect(ampel([null, null, null], keine)).toBe("rot");
  });
});

describe("darfLeeren", () => {
  it("erlaubt, solange zwei gültige Träger bleiben", () => {
    expect(darfLeeren({ gueltigVorher: 3, gueltigNachher: 2 })).toBe(true);
  });

  it("verbietet, unter zwei zu fallen", () => {
    expect(darfLeeren({ gueltigVorher: 2, gueltigNachher: 1 })).toBe(false);
  });

  it("erlaubt das Aufräumen einer ungültigen Stufe, wenn schon vorher weniger als zwei gültig waren", () => {
    expect(darfLeeren({ gueltigVorher: 1, gueltigNachher: 1 })).toBe(true);
  });
});

describe("empfaengerBeiAbwesenheit", () => {
  const stufen = ["key", "v1", "v2"];
  const eskalation = ["gf"];

  it("informiert beide Vertreter, wenn der Key User fehlt", () => {
    const empfaenger = empfaengerBeiAbwesenheit({
      stufen,
      abwesenderId: "key",
      gueltig: menge("key", "v1", "v2"),
      abwesend: menge("key"),
      eskalation,
    });
    expect(empfaenger).toEqual([
      { userId: "v1", rolle: "1. Vertreter" },
      { userId: "v2", rolle: "2. Vertreter" },
    ]);
  });

  it("informiert den Key User, wenn ein Vertreter fehlt", () => {
    const empfaenger = empfaengerBeiAbwesenheit({
      stufen,
      abwesenderId: "v1",
      gueltig: menge("key", "v1", "v2"),
      abwesend: menge("v1"),
      eskalation,
    });
    expect(empfaenger.map((e) => e.userId)).toEqual(["key", "v2"]);
  });

  it("lässt andere abwesende Träger aus", () => {
    const empfaenger = empfaengerBeiAbwesenheit({
      stufen,
      abwesenderId: "key",
      gueltig: menge("key", "v1", "v2"),
      abwesend: menge("key", "v1"),
      eskalation,
    });
    expect(empfaenger.map((e) => e.userId)).toEqual(["v2"]);
  });

  it("geht an die Geschäftsführung, wenn kein Träger erreichbar ist", () => {
    const empfaenger = empfaengerBeiAbwesenheit({
      stufen,
      abwesenderId: "v2",
      gueltig: menge("key", "v1", "v2"),
      abwesend: menge("key", "v1", "v2"),
      eskalation,
    });
    expect(empfaenger).toEqual([{ userId: "gf", rolle: "Geschäftsführung" }]);
  });

  it("lässt eine abwesende Geschäftsführung aus", () => {
    const empfaenger = empfaengerBeiAbwesenheit({
      stufen: ["key", null, null],
      abwesenderId: "key",
      gueltig: menge("key"),
      abwesend: menge("key", "gf"),
      eskalation,
    });
    expect(empfaenger).toEqual([]);
  });

  it("ignoriert ungültige Konten", () => {
    const empfaenger = empfaengerBeiAbwesenheit({
      stufen,
      abwesenderId: "key",
      gueltig: menge("key", "v2"),
      abwesend: menge("key"),
      eskalation,
    });
    expect(empfaenger.map((e) => e.userId)).toEqual(["v2"]);
  });
});

describe("ganztaegigAbwesend", () => {
  const tag = (text: string) => new Date(`${text}T00:00:00Z`);
  const zeitraum = (von: string, bis: string, startHalb = false, endHalb = false) => ({
    von: tag(von),
    bis: tag(bis),
    startHalb,
    endHalb,
  });

  it("gilt innerhalb des Zeitraums", () => {
    expect(ganztaegigAbwesend(zeitraum("2026-12-21", "2026-12-31"), tag("2026-12-23"))).toBe(true);
  });

  it("gilt nicht davor oder danach", () => {
    expect(ganztaegigAbwesend(zeitraum("2026-12-21", "2026-12-31"), tag("2026-12-20"))).toBe(false);
    expect(ganztaegigAbwesend(zeitraum("2026-12-21", "2026-12-31"), tag("2027-01-04"))).toBe(false);
  });

  it("zählt einen halben ersten oder letzten Tag als anwesend", () => {
    expect(ganztaegigAbwesend(zeitraum("2026-12-21", "2026-12-23", true, false), tag("2026-12-21"))).toBe(false);
    expect(ganztaegigAbwesend(zeitraum("2026-12-21", "2026-12-23", false, true), tag("2026-12-23"))).toBe(false);
    expect(ganztaegigAbwesend(zeitraum("2026-12-21", "2026-12-23", true, true), tag("2026-12-22"))).toBe(true);
  });

  it("zählt einen halben Einzeltag als anwesend", () => {
    expect(ganztaegigAbwesend(zeitraum("2026-12-14", "2026-12-14", true), tag("2026-12-14"))).toBe(false);
    expect(ganztaegigAbwesend(zeitraum("2026-12-14", "2026-12-14"), tag("2026-12-14"))).toBe(true);
  });
});
