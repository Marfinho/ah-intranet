import { describe, expect, it } from "vitest";
import { abstandEingehalten, schwellenUeberschreitungen } from "./system-monitor-regeln";

const schwellen = { cpuThresholdPercent: 85, memThresholdPercent: 90, diskThresholdPercent: 90 };

describe("Schwellen der Systemlast", () => {
  it("meldet nichts, solange alles unter der Schwelle liegt", () => {
    expect(schwellenUeberschreitungen({ cpuPercent: 40, memPercent: 50, diskPercent: 60 }, schwellen)).toEqual([]);
  });

  it("meldet genau die überschrittene Größe", () => {
    const ergebnis = schwellenUeberschreitungen({ cpuPercent: 92, memPercent: 50, diskPercent: 60 }, schwellen);
    expect(ergebnis).toHaveLength(1);
    expect(ergebnis[0]).toContain("CPU-Last");
  });

  it("meldet mehrere überschrittene Größen gleichzeitig", () => {
    const ergebnis = schwellenUeberschreitungen({ cpuPercent: 92, memPercent: 95, diskPercent: 99 }, schwellen);
    expect(ergebnis).toHaveLength(3);
  });

  it("zählt den Grenzwert selbst schon als überschritten", () => {
    expect(schwellenUeberschreitungen({ cpuPercent: 85, memPercent: 0, diskPercent: 0 }, schwellen)).toHaveLength(1);
  });
});

describe("Abstand zur letzten Warnung", () => {
  it("lässt die erste Warnung immer zu", () => {
    expect(abstandEingehalten(null, 60, new Date())).toBe(true);
  });

  it("blockt eine zu frühe zweite Warnung", () => {
    const jetzt = new Date("2026-03-02T12:00:00Z");
    const letzte = new Date("2026-03-02T11:30:00Z");
    expect(abstandEingehalten(letzte, 60, jetzt)).toBe(false);
  });

  it("lässt die Warnung nach Ablauf des Abstands wieder zu", () => {
    const jetzt = new Date("2026-03-02T12:31:00Z");
    const letzte = new Date("2026-03-02T11:30:00Z");
    expect(abstandEingehalten(letzte, 60, jetzt)).toBe(true);
  });
});
