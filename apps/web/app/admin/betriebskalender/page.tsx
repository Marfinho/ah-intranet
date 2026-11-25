import Link from "next/link";
import type { BetriebskalenderAnsicht } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui";
import { KalenderForm } from "./kalender-form";
import { KalenderStandort } from "./kalender-standort";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";

export default async function BetriebskalenderPage({ searchParams }: { searchParams: { jahr?: string } }) {
  await requirePermission("organisation.manage");

  const angefragt = Number(searchParams.jahr);
  const jahr =
    Number.isInteger(angefragt) && angefragt >= 2000 && angefragt <= 2100 ? angefragt : new Date().getFullYear();
  const ansicht = await apiGet<BetriebskalenderAnsicht>(`/betriebskalender?jahr=${jahr}`);

  const hausweit = ansicht.eintraege.filter((eintrag) => eintrag.locationId === null);

  return (
    <AppShell
      title="Betriebskalender"
      subtitle="Feiertage, Brückentage, verkaufsoffene Sonntage und Betriebsurlaub - Grundlage für Urlaub und Schichtplan"
    >
      <Section title="Eintragen" subtitle="Was kein Vorschlag abdeckt, tragen Sie hier selbst ein">
        <KalenderForm standorte={ansicht.standorte} jahr={jahr} />
      </Section>

      <Section
        title={`Kalenderjahr ${jahr}`}
        subtitle="Feiertage sind Vorschläge: übernehmen, dann bei Bedarf ändern oder löschen"
      >
        <div className="mb-4 flex items-center gap-4 text-sm font-semibold">
          <Link href={`/admin/betriebskalender?jahr=${jahr - 1}`} className="text-brand-700 hover:underline">
            ← {jahr - 1}
          </Link>
          <Link href={`/admin/betriebskalender?jahr=${jahr + 1}`} className="text-brand-700 hover:underline">
            {jahr + 1} →
          </Link>
        </div>

        <div className="space-y-4">
          {hausweit.length > 0 ? (
            <KalenderStandort
              standort={null}
              jahr={jahr}
              eintraege={hausweit}
              vorschlaege={[]}
              standorte={ansicht.standorte}
              alleEintraege={ansicht.eintraege}
            />
          ) : null}
          {ansicht.standorte.map((standort) => (
            <KalenderStandort
              key={standort.id}
              standort={standort}
              standorte={ansicht.standorte}
              alleEintraege={ansicht.eintraege}
              jahr={jahr}
              eintraege={ansicht.eintraege.filter((eintrag) => eintrag.locationId === standort.id)}
              vorschlaege={ansicht.vorschlaege.filter((vorschlag) => vorschlag.locationId === standort.id)}
            />
          ))}
        </div>
      </Section>
    </AppShell>
  );
}
