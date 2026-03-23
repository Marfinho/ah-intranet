import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d7e7ff",
          600: "#1952c3",
          700: "#113b90",
          900: "#081c4a",
        },
      },
      boxShadow: {
        card: "0 10px 30px rgba(8, 28, 74, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
