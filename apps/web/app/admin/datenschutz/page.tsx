import type { EmployeeDirectoryEntry, RetentionRule } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/forms";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { aufbewahrungAusfuehrenAction } from "@/lib/actions";
import { PersonActions } from "./person-actions";

interface Vorschau {
  key: string;
  label: string;
  days: number;
  cutoff: string;
  entfernt: number;
}

export default async function DatenschutzPage({ searchParams }: { searchParams: { search?: string } }) {
  await requirePermission("privacy.manage");

  const query = new URLSearchParams();
  if (searchParams.search) query.set("search", searchParams.search);

  const [fristen, vorschau, personen] = await Promise.all([
    apiGet<RetentionRule[]>("/datenschutz/aufbewahrung"),
    apiGet<Vorschau[]>("/datenschutz/aufbewahrung/vorschau"),
    apiGet<EmployeeDirectoryEntry[]>(`/users?${query.toString()}`),
  ]);

  const betroffen = vorschau.reduce((summe, eintrag) => summe + eintrag.entfernt, 0);
  const vorschauByKey = new Map(vorschau.map((eintrag) => [eintrag.key, eintrag]));

  return (
    <AppShell title="Datenschutz" subtitle="Auskunft, Löschung und Aufbewahrungsfristen">
      <Section
        title="Aufbewahrung"
        subtitle={
          betroffen === 0
            ? "Derzeit ist kein Datensatz überfällig."
            : `${betroffen} Datensätze sind überfällig und würden beim nächsten Lauf gelöscht.`
        }
        action={
          <ActionButton
            variant={betroffen > 0 ? "primary" : "ghost"}
            confirm={`Aufbewahrungslauf jetzt ausführen? ${betroffen} Datensätze werden endgültig gelöscht.`}
            action={aufbewahrungAusfuehrenAction}
          >
            Lauf jetzt ausführen
          </ActionButton>
        }
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            Der Lauf läuft üblich nachts per Cron (<code>node dist/scripts/aufbewahrung.js</code>). Die Schaltfläche
            oben ist für den Einzelfall gedacht, nicht für den Regelbetrieb.
          </p>
          <p className="mt-2">
            Die Fristen sind begründete Vorgaben, kein Rechtsrat. Vor dem Produktivbetrieb gehören sie mit der
            Rechtsberatung und der Arbeitnehmervertretung des Hauses abgeglichen.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2">Datenart</th>
                <th className="pb-2">Frist</th>
                <th className="pb-2">Behandlung</th>
                <th className="pb-2 text-right">überfällig</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fristen.map((rule) => (
                <tr key={rule.key}>
                  <td className="py-3 align-top">
                    <p className="font-medium text-slate-900">{rule.label}</p>
                    <p className="text-xs text-slate-500">{rule.description}</p>
                    <p className="mt-1 text-xs text-slate-500">{rule.reason}</p>
                  </td>
                  <td className="py-3 align-top whitespace-nowrap text-slate-700">
                    {Math.round((rule.days / 365) * 10) / 10} Jahre
                    <span className="block text-xs text-slate-500">{rule.days} Tage</span>
                  </td>
                  <td className="py-3 align-top">
                    {rule.mode === "delete" ? (
                      <span className="badge bg-emerald-100 text-emerald-800">wird gelöscht</span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-900">aufbewahrungspflichtig</span>
                    )}
                  </td>
                  <td className="py-3 align-top text-right font-semibold text-slate-900">
                    {rule.mode === "delete" ? (vorschauByKey.get(rule.key)?.entfernt ?? 0) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Betroffenenrechte"
        subtitle="Auskunft nach Art. 15 DSGVO und Löschung nach Art. 17 DSGVO – je Person"
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Was „Löschung" hier bedeutet</p>
          <p className="mt-1">
            Das Konto verliert seine Identität, bleibt aber als Anker der Vorgänge bestehen. Bestellungen und
            Freigabeentscheidungen müssen zehn Jahre nachvollziehbar bleiben (§ 147 AO, § 257 HGB) – ein hartes Löschen
            würde sie mitreißen. Rein persönliche Spuren ohne Beweiswert werden wirklich entfernt.
          </p>
          <p className="mt-2">
            Freitexte können eine Person namentlich nennen, ohne dass ein Datenfeld darauf zeigt. Diese Stellen nennt
            die Auskunft; durchsehen muss sie das Haus.
          </p>
        </div>

        <div className="mt-4">
          <FilterBar searchPlaceholder="Person suchen …" />
        </div>

        {personen.length === 0 ? (
          <EmptyState title="Keine Person gefunden" detail="Andere Suche versuchen." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Person</th>
                  <th className="pb-2">Funktion</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Betroffenenrechte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {personen.map((person) => (
                  <tr key={person.id}>
                    <td className="py-3 font-medium text-slate-900">
                      {person.displayName}
                      <span className="block text-xs font-normal text-slate-500">{person.email ?? "—"}</span>
                    </td>
                    <td className="py-3 text-slate-600">{person.jobTitle}</td>
                    <td className="py-3">
                      {person.status === "active" ? (
                        <span className="badge bg-emerald-100 text-emerald-800">aktiv</span>
                      ) : person.status === "deleted" ? (
                        <span className="badge bg-slate-200 text-slate-700">anonymisiert</span>
                      ) : (
                        <span className="badge bg-rose-100 text-rose-800">inaktiv</span>
                      )}
                    </td>
                    <td className="py-3">
                      <PersonActions person={person} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </AppShell>
  );
}
