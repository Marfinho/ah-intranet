import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AHOI", template: "%s · AHOI" },
  description: "Autohaus Organisation & Information – Aushänge, Bestellungen, Freigaben und Anträge an einer Stelle",
};

/**
 * Die Voreinstellung steht am Konto und wird hier serverseitig gesetzt. Zwei
 * Gründe gegen den Weg über den Browser: `rem` bezieht sich auf <html>, also
 * muss die Angabe vor dem ersten Bild stehen - sonst blitzt kurz die kleine
 * Schrift auf. Und wer sie am Tresenrechner wählt, findet sie auf dem Telefon
 * in der Halle wieder, weil sie nicht im Speicher des Browsers liegt.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  let darstellung = "standard";
  try {
    darstellung = (await getSession())?.darstellung ?? "standard";
  } catch {
    // Die Anmeldeseite muss auch dann erscheinen, wenn die API gerade schweigt.
  }

  return (
    <html lang="de" data-darstellung={darstellung}>
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
