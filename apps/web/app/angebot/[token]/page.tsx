import type { Metadata } from "next";
import type { PitchAnsicht } from "@ah-intranet/shared";
import { ApiError, apiGet } from "@/lib/api";
import { Pitch } from "./pitch";
import "./pitch.css";

// Eine Seite für genau einen Empfänger: nicht in Suchmaschinen.
export const metadata: Metadata = {
  title: "AHOI Angebot",
  robots: { index: false, follow: false },
};

export default async function PitchSeite({ params }: { params: { token: string } }) {
  let ansicht: PitchAnsicht;
  try {
    ansicht = await apiGet<PitchAnsicht>(`/angebot/${encodeURIComponent(params.token)}`);
  } catch (error) {
    if (error instanceof ApiError && error.isMissing) {
      return (
        <main className="pitch pitch-leer">
          <h1>Dieser Link ist nicht mehr gültig.</h1>
          <p>Bitte fragen Sie bei Ihrer Ansprechperson nach einem neuen Link.</p>
        </main>
      );
    }
    throw error;
  }

  return (
    <>
      {/* Schrift dieser Seite. Ohne Netz greift die Ersatzschrift im Stylesheet. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;600&display=swap"
      />
      <Pitch token={params.token} ansicht={ansicht} />
    </>
  );
}
