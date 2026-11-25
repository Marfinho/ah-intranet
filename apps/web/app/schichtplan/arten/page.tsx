import Link from "next/link";
import type { OrganigrammKnoten, SchichtartItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { SchichtartFormular } from "./schichtart-formular";
import { SchichtartZeile } from "./schichtart-zeile";
import { apiGet } from "@/lib/api";
import { requireModule, requirePermission } from "@/lib/session";

interface Organisation {
  locations: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}

/** Alle Führungskräfte aus dem Organigramm: wer jemanden unter sich hat, leitet ein Team. */
function fuehrungskraefte(knoten: OrganigrammKnoten[]): { id: string; name: string }[] {
  return knoten.flatMap((eintrag) => [
    ...(eintrag.unterstellte.length > 0 ? [{ id: eintrag.id, name: eintrag.displayName }] : []),
    ...fuehrungskraefte(eintrag.unterstellte),
  ]);
}

export default async function SchichtartenPage() {
  await requireModule("shifts");
  await requirePermission("shifts.manage");

  const [arten, organisation, organigramm] = await Promise.all([
    apiGet<SchichtartItem[]>("/schichtplanung/arten"),
    apiGet<Organisation>("/users/organisation"),
    apiGet<OrganigrammKnoten[]>("/directory/organigramm"),
  ]);
  const standorte = organisation.locations;
  const abteilungen = organisation.departments;
  const teams = fuehrungskraefte(organigramm).sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <AppShell
      title="Schichtarten"
      subtitle="Vorlagen mit Zeitblock und Soll-Besetzung - Grundlage der automatischen Planung"
    >
      <p className="text-sm">
        <Link href="/schichtplan" className="font-semibold text-brand-700 hover:underline">
          ← Zurück zum Schichtplan
        </Link>
      </p>

      <Section
        title="Neue Schichtart"
        subtitle="Für einen Standort, eine Abteilung, ein Team - oder eine Kombination. Ohne Angabe gilt sie im ganzen Haus."
      >
        <SchichtartFormular standorte={standorte} abteilungen={abteilungen} teams={teams} />
      </Section>

      <Section title={`${arten.length} Schichtarten`} subtitle="Die Hinweise nach Arbeitszeitgesetz markieren nur, sie sperren nichts">
        {arten.length === 0 ? (
          <EmptyState title="Noch keine Schichtarten" detail="Legen Sie oben die erste an, z. B. eine Frühschicht von 8 bis 15 Uhr." />
        ) : (
          <ul className="space-y-3">
            {arten.map((art) => (
              <SchichtartZeile key={art.id} art={art} standorte={standorte} abteilungen={abteilungen} teams={teams} />
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
