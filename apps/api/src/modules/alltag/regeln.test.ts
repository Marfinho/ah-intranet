import { describe, expect, it } from "vitest";
import {
  findeAlleUeberschneidungen,
  findeUeberschneidung,
  stichtagVorbei,
  tauschrechte,
  ueberschneidet,
} from "./regeln";

const zeitraum = (von: string, bis: string) => ({ startsAt: new Date(von), endsAt: new Date(bis) });

describe("Überschneidung von Schichten", () => {
  it("erkennt echte Überschneidung", () => {
    expect(
      ueberschneidet(
        zeitraum("2026-03-02T07:00:00Z", "2026-03-02T15:00:00Z"),
        zeitraum("2026-03-02T12:00:00Z", "2026-03-02T19:00:00Z"),
      ),
    ).toBe(true);
  });

  it("lässt Berührung zu - wer um 15 Uhr aufhört, darf um 15 Uhr anfangen", () => {
    expect(
      ueberschneidet(
        zeitraum("2026-03-02T07:00:00Z", "2026-03-02T15:00:00Z"),
        zeitraum("2026-03-02T15:00:00Z", "2026-03-02T22:00:00Z"),
      ),
    ).toBe(false);
  });

  it("erkennt vollständige Umschließung in beide Richtungen", () => {
    const lang = zeitraum("2026-03-02T06:00:00Z", "2026-03-02T20:00:00Z");
    const kurz = zeitraum("2026-03-02T09:00:00Z", "2026-03-02T11:00:00Z");
    expect(ueberschneidet(lang, kurz)).toBe(true);
    expect(ueberschneidet(kurz, lang)).toBe(true);
  });

  it("hält getrennte Tage auseinander", () => {
    expect(
      ueberschneidet(
        zeitraum("2026-03-02T07:00:00Z", "2026-03-02T15:00:00Z"),
        zeitraum("2026-03-03T07:00:00Z", "2026-03-03T15:00:00Z"),
      ),
    ).toBe(false);
  });
});

describe("Rechte an einem Tauschvorgang", () => {
  const beteiligte = { requesterId: "paul", targetId: "lena" };

  it("lässt nur die angefragte Person antworten", () => {
    expect(tauschrechte("offen", beteiligte, "lena", false).canRespond).toBe(true);
    expect(tauschrechte("offen", beteiligte, "paul", false).canRespond).toBe(false);
    expect(tauschrechte("offen", beteiligte, "fremd", true).canRespond).toBe(false);
  });

  it("gibt erst nach der Zustimmung frei - vorher wäre es eine Zuteilung", () => {
    expect(tauschrechte("offen", beteiligte, "chefin", true).canDecide).toBe(false);
    expect(tauschrechte("angenommen", beteiligte, "chefin", true).canDecide).toBe(true);
  });

  it("verlangt für die Freigabe das Recht, nicht die Beteiligung", () => {
    expect(tauschrechte("angenommen", beteiligte, "lena", false).canDecide).toBe(false);
    expect(tauschrechte("angenommen", beteiligte, "fremd", true).canDecide).toBe(true);
  });

  it("lässt nur die anfragende Person zurückziehen, und nur solange es läuft", () => {
    expect(tauschrechte("offen", beteiligte, "paul", false).canWithdraw).toBe(true);
    expect(tauschrechte("angenommen", beteiligte, "paul", false).canWithdraw).toBe(true);
    expect(tauschrechte("freigegeben", beteiligte, "paul", false).canWithdraw).toBe(false);
    expect(tauschrechte("offen", beteiligte, "lena", false).canWithdraw).toBe(false);
  });

  it("lässt an einem abgeschlossenen Vorgang nichts mehr zu", () => {
    for (const status of ["freigegeben", "abgelehnt", "zurueckgezogen"] as const) {
      const rechte = tauschrechte(status, beteiligte, "paul", true);
      expect([rechte.canRespond, rechte.canDecide, rechte.canWithdraw]).toEqual([false, false, false]);
    }
  });
});

describe("Bestellschluss", () => {
  const jetzt = new Date("2026-03-02T10:00:00Z");

  it("lässt vor dem Stichtag bestellen", () => {
    expect(stichtagVorbei(new Date("2026-03-02T10:00:01Z"), jetzt)).toBe(false);
  });

  it("zählt Gleichstand als vorbei - die Abholfahrt wartet nicht auf die Sekunde", () => {
    expect(stichtagVorbei(new Date("2026-03-02T10:00:00Z"), jetzt)).toBe(true);
  });
});

describe("findeUeberschneidung", () => {
  const zeit = (id: string, von: string, bis: string, assigneeId: string | null = "a") => ({
    id,
    label: id,
    assigneeId,
    startsAt: new Date(`2026-01-05T${von}:00Z`),
    endsAt: new Date(`2026-01-05T${bis}:00Z`),
  });

  it("findet eine Überschneidung derselben Person, wenn eine Schicht geändert wurde", () => {
    const fund = findeUeberschneidung([zeit("x", "08:00", "12:00"), zeit("y", "11:00", "15:00")], new Set(["y"]));
    expect(fund?.erste.id).toBe("x");
    expect(fund?.zweite.id).toBe("y");
  });

  it("ignoriert Überschneidungen zwischen unveränderten Schichten", () => {
    expect(findeUeberschneidung([zeit("x", "08:00", "12:00"), zeit("y", "11:00", "15:00")], new Set(["z"]))).toBeNull();
  });

  it("lässt Berührung zu", () => {
    expect(
      findeUeberschneidung([zeit("x", "08:00", "12:00"), zeit("y", "12:00", "15:00")], new Set(["x", "y"])),
    ).toBeNull();
  });

  it("ignoriert verschiedene Personen und offene Schichten", () => {
    expect(
      findeUeberschneidung([zeit("x", "08:00", "12:00", "a"), zeit("y", "09:00", "12:00", "b")], new Set(["x", "y"])),
    ).toBeNull();
    expect(
      findeUeberschneidung([zeit("x", "08:00", "12:00", null), zeit("y", "09:00", "12:00", null)], new Set(["x", "y"])),
    ).toBeNull();
  });

  it("billigt einen Endzustand, in dem zwei Schichten derselben Person die Plätze getauscht haben", () => {
    // Früh 8-12 und Spät 13-17 vertauscht: Früh 13-17, Spät 8-12. Einzeln gegen die DB wäre das ein Konflikt.
    expect(
      findeUeberschneidung(
        [zeit("frueh", "13:00", "17:00"), zeit("spaet", "08:00", "12:00")],
        new Set(["frueh", "spaet"]),
      ),
    ).toBeNull();
  });
});

describe("findeAlleUeberschneidungen", () => {
  const zeit = (id: string, von: string, bis: string, assigneeId = "a") => ({
    id,
    label: id,
    assigneeId,
    startsAt: new Date(`2026-01-05T${von}:00Z`),
    endsAt: new Date(`2026-01-05T${bis}:00Z`),
  });

  it("liefert jedes überschneidende Paar", () => {
    const funde = findeAlleUeberschneidungen(
      [zeit("x", "08:00", "12:00"), zeit("y", "11:00", "15:00"), zeit("z", "14:00", "16:00")],
      new Set(["x", "y", "z"]),
    );
    expect(funde.map((f) => `${f.erste.id}-${f.zweite.id}`)).toEqual(["x-y", "y-z"]);
  });

  it("liefert nichts ohne Überschneidung", () => {
    expect(
      findeAlleUeberschneidungen([zeit("x", "08:00", "12:00"), zeit("y", "12:00", "15:00")], new Set(["x", "y"])),
    ).toEqual([]);
  });
});
