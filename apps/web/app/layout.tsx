import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AHOI", template: "%s · AHOI" },
  description: "Autohaus Organisation & Information – Aushänge, Bestellungen, Freigaben und Anträge an einer Stelle",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* Hausschrift laut docs/ci.md. Bewusst als Verweis und nicht über
            next/font: der Bau der Anwendung soll nicht von einem Download
            abhängen. Die Ersatzschriften stehen in der Tailwind-Konfiguration. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Source+Sans+3:wght@400;600&display=swap"
        />
        <link rel="icon" href="/ahoi-signet.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
