/**
 * Schreibt `src/generated/modell-meta.ts` aus `schema.prisma` (siehe
 * `src/core/modell-meta-lesen.ts`). Läuft als Teil von `pnpm --filter api prisma:generate`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { leseModellMeta } from "../src/core/modell-meta-lesen";

export function schreibeModellMeta(schemaPfad: string, zielPfad: string): void {
  const meta = leseModellMeta(readFileSync(schemaPfad, "utf8"));
  mkdirSync(dirname(zielPfad), { recursive: true });
  writeFileSync(
    zielPfad,
    `// Erzeugt von prisma/modell-meta.ts - nicht von Hand ändern.\n` +
      `export const MODELL_META: Record<string, Record<string, { target: string; owned: boolean }>> = ${JSON.stringify(meta, null, 2)};\n`,
  );
}

if (require.main === module) {
  const wurzel = join(__dirname, "..");
  schreibeModellMeta(join(wurzel, "prisma/schema.prisma"), join(wurzel, "src/generated/modell-meta.ts"));
}
