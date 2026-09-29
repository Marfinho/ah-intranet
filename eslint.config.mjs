import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

/**
 * Gemeinsame Lint-Regeln für das gesamte Monorepo.
 *
 * Bewusst ohne typgestützte Regeln (`recommendedTypeChecked`): die brauchen ein
 * Programm je Paket und verdreifachen die Laufzeit. Die Typprüfung übernimmt
 * `tsc --noEmit` separat; ESLint kümmert sich um Muster, die der Compiler
 * durchgehen lässt.
 */
export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/*.d.ts", "apps/api/prisma/migrations/**"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // Ungenutzte Variablen sind fast immer ein Rest vom Umbau. Führende
      // Unterstriche bleiben erlaubt, um bewusst ignorierte Parameter zu kennzeichnen.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // `any` hebelt die Typsicherheit aus; wo es nötig ist, soll es auffallen.
      "@typescript-eslint/no-explicit-any": "warn",
      // Leere catch-Blöcke sind hier Absicht (z. B. optionales Aufräumen).
      "no-empty": ["error", { allowEmptyCatch: true }],
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Seed und Prüfskripte laufen in Node und dürfen auf die Konsole schreiben.
  {
    files: [
      "apps/api/prisma/seed.ts",
      "apps/api/src/scripts/**/*.ts",
      "e2e/**/*.js",
      "scripts/**/*.{js,mjs,ts}",
      "**/*.config.js",
    ],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "writable",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        Buffer: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Testdateien dürfen großzügiger sein.
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },

  prettier,
);
