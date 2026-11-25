import type { OrganigrammKnoten } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";

/** Eine Person samt Unterstellten. Verschachtelte Listen statt Zeichnung: lesbar auf dem Telefon in der Halle. */
function Zweig({ knoten }: { knoten: OrganigrammKnoten }) {
  return (
    <li>
      <div className="rounded-2xl border border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">{knoten.displayName}</p>
          {!knoten.hasAccess ? <span className="badge bg-slate-100 text-slate-600">ohne Zugang</span> : null}
        </div>
        <p className="text-sm text-slate-600">
          {knoten.jobTitle} · {knoten.location ?? "ohne Standort"} · {knoten.department ?? "ohne Abteilung"}
        </p>
      </div>
      {knoten.unterstellte.length > 0 ? (
        <ul className="ml-4 mt-2 space-y-2 border-l-2 border-slate-200 pl-4">
          {knoten.unterstellte.map((kind) => (
            <Zweig key={kind.id} knoten={kind} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default async function OrganigrammPage() {
  await requireModule("directory");
  const wurzeln = await apiGet<OrganigrammKnoten[]>("/directory/organigramm");

  return (
    <AppShell title="Organigramm" subtitle="Wer berichtet an wen">
      <Section title="Aufbau des Hauses" subtitle="Die Vorgesetzten pflegt die Benutzerverwaltung">
        {wurzeln.length === 0 ? (
          <EmptyState title="Noch keine Personen" detail="Sobald Personen angelegt sind, erscheinen sie hier." />
        ) : (
          <ul className="space-y-2">
            {wurzeln.map((knoten) => (
              <Zweig key={knoten.id} knoten={knoten} />
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
