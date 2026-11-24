import { JwtService } from "@nestjs/jwt";
import { describe, expect, it } from "vitest";

/** Hält fest, was die Konfiguration in `auth.module.ts` verspricht. */
describe("JWT-Algorithmus", () => {
  const dienst = new JwtService({
    secret: "geheim-geheim-geheim-geheim-geheim",
    signOptions: { algorithm: "HS256" },
    verifyOptions: { algorithms: ["HS256"] },
  });

  it("nimmt ein gültig signiertes HS256-Token an", async () => {
    const token = await dienst.signAsync({ sub: "1" });
    await expect(dienst.verifyAsync(token)).resolves.toMatchObject({ sub: "1" });
  });

  it("weist ein Token mit alg=none ab", async () => {
    const kopf = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const inhalt = Buffer.from(JSON.stringify({ sub: "1" })).toString("base64url");
    await expect(dienst.verifyAsync(`${kopf}.${inhalt}.`)).rejects.toThrow();
  });

  it("weist ein mit einem anderen Verfahren signiertes Token ab", async () => {
    const token = await dienst.signAsync({ sub: "1" }, { algorithm: "HS384" });
    await expect(dienst.verifyAsync(token)).rejects.toThrow();
  });
});
