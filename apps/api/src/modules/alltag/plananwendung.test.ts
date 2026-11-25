import { describe, expect, it } from "vitest";
import { lokalZuUtc, type PlanEntwurfItem } from "@ah-intranet/shared";
import { ermittleAnwendung, istGeaendert, meldungenJePerson, zeitText, type LiveSchicht } from "./plananwendung";

const t = (datum: string, h: number, m = 0) => lokalZuUtc(datum, h * 60 + m);
const stand = new Date("2026-01-01T10:00:00.000Z");

const live = (id: string, aenderungen: Partial<LiveSchicht> = {}): LiveSchicht => ({
  id,
  label: "Frühschicht",
  startsAt: t("2026-01-06", 8),
  endsAt: t("2026-01-06", 15),
  assigneeId: "karin",
  pauseMinuten: 30,
  note: null,
  updatedAt: stand,
  ...aenderungen,
});

/** Ein Entwurfselement, das unverändert dem echten entspricht. */
const abbild = (echt: LiveSchicht, aenderungen: Partial<PlanEntwurfItem> = {}): PlanEntwurfItem => ({
  key: `k-${echt.id}`,
  liveId: echt.id,
  liveStand: echt.updatedAt.toISOString(),
  label: echt.label,
  startsAt: echt.startsAt.toISOString(),
  endsAt: echt.endsAt.toISOString(),
  pauseMinuten: echt.pauseMinuten,
  assigneeId: echt.assigneeId,
  schichtartId: null,
  locationId: null,
  departmentId: null,
  note: echt.note,
  ...aenderungen,
});

const neu = (key: string, aenderungen: Partial<PlanEntwurfItem> = {}): PlanEntwurfItem => ({
  key,
  liveId: null,
  liveStand: null,
  label: "Spätschicht",
  startsAt: t("2026-01-07", 12).toISOString(),
  endsAt: t("2026-01-07", 20).toISOString(),
  pauseMinuten: 30,
  assigneeId: "selin",
  schichtartId: null,
  locationId: null,
  departmentId: null,
  note: null,
  ...aenderungen,
});

describe("istGeaendert", () => {
  it("erkennt ein unverändertes Abbild", () => {
    const echt = live("a");
    expect(istGeaendert(echt, abbild(echt))).toBe(false);
  });

  it.each([
    ["Zeit", { startsAt: t("2026-01-06", 9).toISOString() }],
    ["Person", { assigneeId: "tom" }],
    ["Bezeichnung", { label: "Anderes" }],
    ["Pause", { pauseMinuten: 45 }],
    ["Notiz", { note: "Schlüssel" }],
  ])("erkennt eine geänderte %s", (_name, aenderung) => {
    const echt = live("a");
    expect(istGeaendert(echt, abbild(echt, aenderung as Partial<PlanEntwurfItem>))).toBe(true);
  });
});

describe("ermittleAnwendung", () => {
  it("legt neue Elemente an", () => {
    const erg = ermittleAnwendung([], [neu("n")]);
    expect(erg.anlegen.map((i) => i.key)).toEqual(["n"]);
  });

  it("legt ein neu angelegtes, schon wieder entferntes Element nicht an", () => {
    expect(ermittleAnwendung([], [neu("n", { geloescht: true })]).anlegen).toEqual([]);
  });

  it("lässt unveränderte Elemente in Ruhe", () => {
    const echt = live("a");
    const erg = ermittleAnwendung([echt], [abbild(echt)]);
    expect(erg).toEqual({ anlegen: [], aendern: [], loeschen: [], veraltet: [], verschwunden: [] });
  });

  it("ändert und entfernt echte Schichten", () => {
    const a = live("a");
    const b = live("b");
    const erg = ermittleAnwendung([a, b], [abbild(a, { assigneeId: "tom" }), abbild(b, { geloescht: true })]);
    expect(erg.aendern.map((e) => e.live.id)).toEqual(["a"]);
    expect(erg.loeschen.map((l) => l.id)).toEqual(["b"]);
  });

  it("meldet eine inzwischen anderswo geänderte Schicht als veraltet - aber nur, wenn der Entwurf sie anfasst", () => {
    const geaendert = live("a", { updatedAt: new Date("2026-01-02T10:00:00.000Z") });
    const unberuehrt = live("b", { updatedAt: new Date("2026-01-02T10:00:00.000Z") });
    const alterStand = new Date("2026-01-01T10:00:00.000Z").toISOString();
    const erg = ermittleAnwendung(
      [geaendert, unberuehrt],
      [
        abbild(geaendert, { assigneeId: "tom", liveStand: alterStand }),
        // gleiche Veränderung der echten Schicht, aber der Entwurf ändert sie nicht
        {
          ...abbild(live("b")),
          liveStand: alterStand,
          startsAt: unberuehrt.startsAt.toISOString(),
          endsAt: unberuehrt.endsAt.toISOString(),
        },
      ],
    );
    expect(erg.veraltet.map((v) => v.id)).toEqual(["a"]);
    expect(erg.aendern).toEqual([]);
  });

  it("meldet verschwundene echte Schichten, außer der Entwurf wollte sie ohnehin entfernen", () => {
    const echt = live("weg");
    expect(ermittleAnwendung([], [abbild(echt, { assigneeId: "tom" })]).verschwunden).toEqual(["weg"]);
    expect(ermittleAnwendung([], [abbild(echt, { geloescht: true })]).verschwunden).toEqual([]);
  });
});

describe("meldungenJePerson", () => {
  it("fasst alles je Person in einer Liste zusammen", () => {
    const a = live("a", { assigneeId: "karin" });
    const b = live("b", { assigneeId: "karin", startsAt: t("2026-01-08", 8), endsAt: t("2026-01-08", 15) });
    const erg = ermittleAnwendung(
      [a, b],
      [
        abbild(a, { startsAt: t("2026-01-06", 9).toISOString(), endsAt: t("2026-01-06", 16).toISOString() }),
        abbild(b, { geloescht: true }),
        neu("n", { assigneeId: "karin" }),
      ],
    );
    const meldungen = meldungenJePerson(erg);
    expect(meldungen.size).toBe(1);
    expect(meldungen.get("karin")).toHaveLength(3);
  });

  it("meldet beim Personenwechsel beiden: der neuen Person Neu, der alten Entfällt", () => {
    const echt = live("a", { assigneeId: "karin" });
    const erg = ermittleAnwendung([echt], [abbild(echt, { assigneeId: "tom" })]);
    const meldungen = meldungenJePerson(erg);
    expect(meldungen.get("tom")?.[0]).toMatch(/^Neu: Frühschicht/);
    expect(meldungen.get("karin")?.[0]).toMatch(/^Entfällt: Frühschicht/);
  });

  it("nennt bei einer Zeitänderung auch die alte Zeit", () => {
    const echt = live("a");
    const erg = ermittleAnwendung([echt], [abbild(echt, { startsAt: t("2026-01-06", 9).toISOString() })]);
    expect(meldungenJePerson(erg).get("karin")?.[0]).toContain("vorher Di 06.01., 08:00–15:00 Uhr");
  });

  it("meldet nichts bei Änderungen, die nur Pause oder Notiz betreffen", () => {
    const echt = live("a");
    const erg = ermittleAnwendung([echt], [abbild(echt, { pauseMinuten: 45, note: "Hinweis" })]);
    expect(erg.aendern).toHaveLength(1);
    expect(meldungenJePerson(erg).size).toBe(0);
  });

  it("meldet nichts für offene Schichten", () => {
    const erg = ermittleAnwendung([], [neu("n", { assigneeId: null })]);
    expect(meldungenJePerson(erg).size).toBe(0);
  });
});

describe("zeitText", () => {
  it("nennt Wochentag, Datum und Ortszeit", () => {
    expect(zeitText(t("2026-01-06", 8), t("2026-01-06", 15))).toBe("Di 06.01., 08:00–15:00 Uhr");
  });
});
