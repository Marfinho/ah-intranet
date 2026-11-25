import type { OrganigrammKnoten } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";

/**
 * Eine Person samt Unterstellten. Der Baum läuft von oben nach unten; die
 * Verbinder zeichnet `.org-baum` in globals.css. Die Karten sind gleich breit,
 * damit die Linien mittig sitzen.
 */
function Zweig({ knoten }: { knoten: OrganigrammKnoten }) {
  return (
    <li>
      <div className="w-40 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
        <p className="text-sm font-semibold text-slate-900">{knoten.displayName}</p>
        <p className="mt-0.5 text-xs text-slate-600">{knoten.jobTitle}</p>
        <p className="mt-0.5 text-xs text-slate-500">{knoten.department ?? knoten.location ?? "ohne Abteilung"}</p>
        {!knoten.hasAccess ? <span className="badge mt-2 bg-slate-100 text-slate-600">ohne Zugang</span> : null}
      </div>
      {knoten.unterstellte.length > 0 ? (
        <ul>
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
          <div className="overflow-x-auto pb-4">
            <ul className="org-baum mx-auto w-max min-w-full">
              {wurzeln.map((knoten) => (
                <Zweig key={knoten.id} knoten={knoten} />
              ))}
            </ul>
          </div>
        )}
      </Section>
    </AppShell>
  );
}
