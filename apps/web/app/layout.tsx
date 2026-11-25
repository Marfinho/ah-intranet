import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
// Hausschrift laut docs/ci.md, mit der Anwendung ausgeliefert statt von Google
// geladen: ein Abruf bei Google überträgt die IP-Adresse jeder Mitarbeiterin an
// einen Dritten, und die Content-Security-Policy kann dann bei "self" bleiben.
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AHOI", template: "%s · AHOI" },
  description: "Autohaus Organisation & Information – Aushänge, Bestellungen, Freigaben und Anträge an einer Stelle",
};

// Ohne diese Angabe rechnet ein Telefon mit einer 980 Pixel breiten Seite und
// verkleinert sie auf Briefmarkengröße. viewportFit "cover" erlaubt das Zeichnen
// unter Kerbe und Home-Balken; die Leisten halten Abstand mit safe-area-inset.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Die Content-Security-Policy trägt je Anfrage eine neue Einmalkennung
  // (Middleware). Next setzt sie nur auf Seiten, die pro Anfrage gerendert
  // werden - eine vorab erzeugte statische Seite hätte Skripte ohne Kennung,
  // und der Browser verwürfe sie. Der Aufruf macht alle Seiten dynamisch.
  await headers();

  return (
    <html lang="de">
      <head>
        <link rel="icon" href="/ahoi-signet.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
