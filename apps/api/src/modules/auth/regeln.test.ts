import { describe, expect, it } from "vitest";
import { FREIVERSUCHE, gesperrtBis, sperrdauerSekunden } from "./regeln";

describe("Wartezeit nach Fehlversuchen", () => {
  it("lässt Vertipper ungestraft", () => {
    for (let versuch = 1; versuch <= FREIVERSUCHE; versuch += 1) {
      expect(sperrdauerSekunden(versuch)).toBe(0);
    }
  });

  it("beginnt mit einer Minute statt einer Viertelstunde", () => {
    // Der entscheidende Unterschied zur früheren flachen Sperre: wer sich
    // vertippt hat, wartet eine Minute, nicht fünfzehn.
    expect(sperrdauerSekunden(FREIVERSUCHE + 1)).toBe(60);
  });

  it("verdoppelt mit jedem weiteren Versuch", () => {
    expect(sperrdauerSekunden(6)).toBe(120);
    expect(sperrdauerSekunden(7)).toBe(240);
    expect(sperrdauerSekunden(8)).toBe(480);
  });

  it("deckelt bei einer Viertelstunde", () => {
    expect(sperrdauerSekunden(9)).toBe(900);
    expect(sperrdauerSekunden(50)).toBe(900);
  });

  it("drosselt systematisches Raten stärker als die frühere flache Sperre", () => {
    const versuchePro = (dauerSekunden: number) => {
      let sekunden = 0;
      let versuche = 0;
      while (sekunden < dauerSekunden) {
        versuche += 1;
        sekunden += sperrdauerSekunden(versuche);
      }
      return versuche;
    };

    const tag = 24 * 60 * 60;
    // Die frühere Regel ließ fünf Versuche je 15 Minuten zu - 480 am Tag.
    const frueher = (tag / (15 * 60)) * 5;

    expect(versuchePro(tag)).toBeLessThan(frueher / 4);
    // Gegen ein Passwort mit zehn Stellen ist das folgenlos; die Zahl steht
    // hier, damit eine spätere Änderung der Kurve nicht unbemerkt lockerer wird.
    expect(versuchePro(tag)).toBeLessThan(120);
  });

  it("liefert keinen Sperrzeitpunkt, solange nichts zu warten ist", () => {
    expect(gesperrtBis(1)).toBeNull();
  });

  it("rechnet den Sperrzeitpunkt vom übergebenen Jetzt aus", () => {
    const jetzt = new Date("2026-03-01T10:00:00Z");
    expect(gesperrtBis(5, jetzt)).toEqual(new Date("2026-03-01T10:01:00Z"));
  });
});
