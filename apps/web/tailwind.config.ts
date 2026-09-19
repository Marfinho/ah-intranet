import type { Config } from "tailwindcss";

/**
 * Das Erscheinungsbild AHOI – siehe `docs/ci.md`.
 *
 * `brand` ist der Akzent der Marke, nicht die Zustandsfarbe: Erledigt, Wartend
 * und Abgelehnt kommen weiterhin aus Grün, Bernstein und Rosé und tragen immer
 * ein Wort, nie nur einen Farbton.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef4f0",
          100: "#fbe3d9",
          200: "#f7c3b0",
          300: "#f09b7c",
          400: "#e86b44",
          500: "#dc3a14",
          600: "#c42f0e",
          700: "#a2270c",
          800: "#7e1f0a",
          900: "#5c1707",
        },
      },
      fontFamily: {
        display: ['"Archivo"', '"Helvetica Neue"', "Arial", "sans-serif"],
        sans: ['"Source Sans 3"', '"Segoe UI"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px rgba(15, 20, 23, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
