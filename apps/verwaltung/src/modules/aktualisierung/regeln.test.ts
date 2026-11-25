import { describe, expect, it } from "vitest";
import { aktualisiererLebt, auswirkungen, bewerteAnforderung, ciZustand, kurz, zuBauen } from "./regeln";

const A = "a".repeat(40);
const B = "b".repeat(40);
const gut = {
  installiert: A,
  ziel: B,
  zielGegenInstalliert: "ahead" as const,
  zielAufMain: true,
  ci: "gruen" as const,
  aktiverAuftrag: false,
  aktualisiererLebt: true,
};

describe("Prüfpipeline", () => {
  it("eine rote genügt, laufende machen es unentschieden", () => {
    expect(
      ciZustand([
        { name: "a", status: "completed", conclusion: "success" },
        { name: "b", status: "completed", conclusion: "failure" },
      ]),
    ).toBe("rot");
    expect(
      ciZustand([
        { name: "a", status: "completed", conclusion: "success" },
        { name: "b", status: "in_progress" },
      ]),
    ).toBe("laeuft");
    expect(
      ciZustand([
        { name: "a", status: "completed", conclusion: "success" },
        { name: "b", status: "completed", conclusion: "skipped" },
      ]),
    ).toBe("gruen");
  });
  it("ohne Prüfungen ist nichts bewiesen", () => {
    expect(ciZustand([])).toBe("unbekannt");
  });
  it("rot schlägt laufend", () => {
    expect(
      ciZustand([
        { name: "a", status: "in_progress" },
        { name: "b", status: "completed", conclusion: "timed_out" },
      ]),
    ).toBe("rot");
  });
});

describe("Anforderung", () => {
  it("erlaubt einen neueren, grünen Stand auf main", () => {
    expect(bewerteAnforderung(gut)).toEqual({ darfAnfordern: true, gruende: [] });
  });
  it.each([
    ["bereits installiert", { ziel: A, zielGegenInstalliert: "identical" as const }],
    ["älterer Stand", { zielGegenInstalliert: "behind" as const }],
    ["fremder Zweig", { zielGegenInstalliert: "diverged" as const }],
    ["nicht auf main", { zielAufMain: false }],
    ["rote Pipeline", { ci: "rot" as const }],
    ["laufende Pipeline", { ci: "laeuft" as const }],
    ["keine Pipeline", { ci: "unbekannt" as const }],
    ["anderer Auftrag", { aktiverAuftrag: true }],
    ["Aktualisierer fehlt", { aktualisiererLebt: false }],
    ["unbekannter Stand", { installiert: null }],
    ["ungültige Kennung", { ziel: "main; rm -rf /" }],
  ])("lehnt ab: %s", (_name, abweichung) => {
    const ergebnis = bewerteAnforderung({ ...gut, ...abweichung });
    expect(ergebnis.darfAnfordern).toBe(false);
    expect(ergebnis.gruende.length).toBeGreaterThan(0);
  });
});

describe("Lebenszeichen", () => {
  const jetzt = new Date("2026-11-25T12:00:00Z");
  it("drei Minuten Stille gelten als ausgefallen", () => {
    expect(aktualisiererLebt(new Date("2026-11-25T11:58:30Z"), jetzt)).toBe(true);
    expect(aktualisiererLebt(new Date("2026-11-25T11:56:00Z"), jetzt)).toBe(false);
    expect(aktualisiererLebt(null, jetzt)).toBe(false);
  });
});

describe("Auswirkungen", () => {
  it("erkennt Migrationen, Rolle und Abhängigkeiten", () => {
    const a = auswirkungen([
      { filename: "apps/api/prisma/migrations/2026_x/migration.sql" },
      { filename: "scripts/verwaltung-rolle.sql" },
      { filename: "pnpm-lock.yaml" },
      { filename: "docker-compose.prod.yml" },
      { filename: "Caddyfile.prod" },
    ]).map((x) => x.art);
    expect(a).toEqual(["migration", "rolle", "abhaengigkeiten", "konfiguration", "proxy"]);
    expect(auswirkungen([{ filename: "docs/x.md" }])).toEqual([]);
  });
  it("baut nur, was sich ändert; gemeinsame Pakete betreffen alle", () => {
    expect(zuBauen([{ filename: "apps/web/app/page.tsx" }])).toEqual({ api: false, web: true, verwaltung: false });
    expect(zuBauen([{ filename: "packages/shared/src/x.ts" }])).toEqual({ api: true, web: true, verwaltung: true });
    expect(zuBauen([{ filename: "README.md" }])).toEqual({ api: false, web: false, verwaltung: false });
  });
  it("kürzt Kennungen", () => {
    expect(kurz(A)).toBe("aaaaaaa");
    expect(kurz(null)).toBe("–");
  });
});
