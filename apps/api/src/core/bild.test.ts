import { describe, expect, it } from "vitest";
import { erkenneBildtyp } from "./bild";

describe("erkenneBildtyp", () => {
  it("erkennt PNG, JPEG und WebP am Dateikopf", () => {
    expect(erkenneBildtyp(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("image/png");
    expect(erkenneBildtyp(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe("image/jpeg");
    expect(
      erkenneBildtyp(Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBPVP8 ")])),
    ).toBe("image/webp");
  });

  it("weist HTML und SVG ab, auch wenn sie sich als Bild ausgeben", () => {
    expect(erkenneBildtyp(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(erkenneBildtyp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });

  it("weist andere RIFF-Container ab, etwa WAV", () => {
    expect(
      erkenneBildtyp(Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WAVEfmt ")])),
    ).toBeNull();
  });

  it("kommt mit leeren und zu kurzen Eingaben zurecht", () => {
    expect(erkenneBildtyp(Buffer.alloc(0))).toBeNull();
    expect(erkenneBildtyp(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});
