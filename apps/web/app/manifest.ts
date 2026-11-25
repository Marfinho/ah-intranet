import type { MetadataRoute } from "next";

/**
 * Ermöglicht „Zum Home-Bildschirm“: AHOI startet dann ohne Adressleiste wie eine
 * App. Bewusst ohne Service Worker - Offline-Betrieb wäre ein eigener Entwurf
 * (veraltete Freigaben und Schichtpläne wären gefährlicher als ein Ladefehler).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AHOI – Autohaus Organisation & Information",
    short_name: "AHOI",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "de",
    icons: [{ src: "/ahoi-signet.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
