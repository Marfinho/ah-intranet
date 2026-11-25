import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node-Umgebung: die getesteten Einheiten sind reine Logik ohne DOM.
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/main.ts", "src/**/*.module.ts"],
    },
  },
});
