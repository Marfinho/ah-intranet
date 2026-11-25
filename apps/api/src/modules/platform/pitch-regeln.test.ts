import { describe, expect, it } from "vitest";
import { hashToken, linkGueltigBis, linkIstGueltig, neuesToken } from "./pitch-regeln";

describe("Link", () => {
  it("erzeugt unterschiedliche, lange Token", () => {
    const a = neuesToken();
    expect(a).not.toBe(neuesToken());
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it("hasht stabil und gibt den Klartext nicht preis", () => {
    const token = neuesToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toHaveLength(64);
  });

  it("begrenzt die Gültigkeit", () => {
    const jetzt = new Date("2026-01-01T00:00:00Z");
    expect(linkGueltigBis(60, jetzt).toISOString()).toBe("2026-03-02T00:00:00.000Z");
    expect(linkGueltigBis(100000, jetzt).getTime() - jetzt.getTime()).toBe(365 * 86400000);
    expect(linkGueltigBis(0, jetzt).getTime() - jetzt.getTime()).toBe(86400000);
  });

  it("lehnt abgelaufene und widerrufene Links ab", () => {
    const jetzt = new Date("2026-06-01T00:00:00Z");
    expect(linkIstGueltig({ tokenGueltigBis: new Date("2026-07-01"), tokenWiderrufenAm: null }, jetzt)).toBe(true);
    expect(linkIstGueltig({ tokenGueltigBis: new Date("2026-05-01"), tokenWiderrufenAm: null }, jetzt)).toBe(false);
    expect(
      linkIstGueltig({ tokenGueltigBis: new Date("2026-07-01"), tokenWiderrufenAm: new Date("2026-05-01") }, jetzt),
    ).toBe(false);
  });
});
