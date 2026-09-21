import type { Config } from "tailwindcss";

/**
 * Das Erscheinungsbild AHOI – siehe `docs/ci.md`.
 *
 * `brand` ist der Akzent der Marke, nicht die Zustandsfarbe: Erledigt, Wartend
 * und Abgelehnt kommen weiterhin aus Grün, Bernstein und Rosé und tragen immer
 * ein Wort, nie nur einen Farbton.
 *
 * Farben und Schriftgrößen stehen nicht als feste Werte hier, sondern als
 * Variablen in `globals.css`. Damit verschiebt die Voreinstellung der
 * Darstellung ("Standard" / "Groß & klar") dieselben Achsen für alle rund 80
 * Seiten auf einmal – es gibt ein Erscheinungsbild, nicht zwei.
 * `<alpha-value>` erhält dabei die Kurzschreibweise `bg-brand-50/40`.
 */
const ton = (name: string) => `rgb(var(--ahoi-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: ton("brand-50"),
          100: ton("brand-100"),
          200: ton("brand-200"),
          300: ton("brand-300"),
          400: ton("brand-400"),
          500: ton("brand-500"),
          600: ton("brand-600"),
          700: ton("brand-700"),
          800: ton("brand-800"),
          900: ton("brand-900"),
        },
        slate: {
          50: ton("slate-50"),
          100: ton("slate-100"),
          200: ton("slate-200"),
          300: ton("slate-300"),
          400: ton("slate-400"),
          500: ton("slate-500"),
          600: ton("slate-600"),
          700: ton("slate-700"),
          800: ton("slate-800"),
          900: ton("slate-900"),
        },
      },
      /**
       * Eigene Stufen statt der Tailwind-Vorgaben: `text-sm` ist mit 203
       * Fundstellen die Brotschrift der Anwendung und lag bei 14 px. 16 px ist
       * die untere Grenze, unter der Fließtext am Bildschirm mühsam wird
       * (WCAG 1.4.4, WAI-AGE). Die Zeilenhöhe kommt aus einer Variablen, damit
       * "Groß & klar" nicht nur die Schrift, sondern auch die Luft dazwischen
       * vergrößert – Enge ist beim Lesen das größere Hindernis als Größe.
       */
      fontSize: {
        xs: ["0.875rem", { lineHeight: "var(--ahoi-zeilenluft)" }],
        sm: ["1rem", { lineHeight: "var(--ahoi-zeilenluft)" }],
        base: ["1.0625rem", { lineHeight: "var(--ahoi-zeilenluft)" }],
        lg: ["1.1875rem", { lineHeight: "var(--ahoi-zeilenluft-eng)" }],
        xl: ["1.375rem", { lineHeight: "var(--ahoi-zeilenluft-eng)" }],
        "2xl": ["1.625rem", { lineHeight: "var(--ahoi-zeilenluft-eng)" }],
        "3xl": ["1.9375rem", { lineHeight: "var(--ahoi-zeilenluft-eng)" }],
        "4xl": ["2.25rem", { lineHeight: "var(--ahoi-zeilenluft-eng)" }],
        "5xl": ["2.75rem", { lineHeight: "var(--ahoi-zeilenluft-eng)" }],
      },
      minHeight: {
        ziel: "var(--ahoi-zielgroesse)",
      },
      minWidth: {
        ziel: "var(--ahoi-zielgroesse)",
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
