import type { Absence, AbsenceBalance } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { ActionButton } from "@/components/forms";
import { DataGrid, EmptyState, MetricCard, Section, StatusBadge, statusLabel } from "@/components/ui";
import { AbsenceComposer } from "./absence-composer";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";
import { cancelAbsenceAction, decideAbsenceAction } from "@/lib/actions";
import { formatDate } from "@/lib/utils";

interface AbsencesResponse {
  items: Absence[];
  canSeeTeam: boolean;
}

export default async function AbsencesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ scope?: string; status?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireModule("absences");

  const scope = searchParams.scope === "team" ? "team" : "mine";
  const query = new URLSearchParams({ scope });
  if (searchParams.status) query.set("status", searchParams.status);

  const [data, balance] = await Promise.all([
    apiGet<AbsencesResponse>(`/absences?${query.toString()}`),
    apiGet<AbsenceBalance>("/absences/balance"),
  ]);

  return (
    <AppShell title="Abwesenheiten" subtitle="Urlaub, Krankmeldungen und Fortbildungen beantragen und freigeben">
      <DataGrid>
        <MetricCard label="Urlaubsanspruch" value={String(balance.annualEntitlement)} helper="Arbeitstage pro Jahr" />
        <MetricCard label="Genehmigt" value={String(balance.approved)} helper="bereits freigegeben" />
        <MetricCard label="In Freigabe" value={String(balance.pending)} helper="noch nicht entschieden" />
        <MetricCard label="Rest" value={String(balance.remaining)} helper="verfügbare Arbeitstage" />
      </DataGrid>

      <Section title="Neuer Antrag" subtitle="Arbeitstage werden automatisch berechnet, Wochenenden zählen nicht">
        <AbsenceComposer />
      </Section>

      <Section
        title={scope === "team" ? "Anträge im Team" : "Meine Anträge"}
        subtitle={
          data.canSeeTeam ? "Zwischen eigenen Anträgen und Teamansicht wechseln" : "Ihre eingereichten Zeiträume"
        }
      >
        <div className="space-y-4">
          <FilterBar
            showSearch={false}
            selects={[
              ...(data.canSeeTeam
                ? [
                    {
                      name: "scope",
                      label: "Meine Anträge",
                      options: [
                        { value: "mine", label: "Meine Anträge" },
                        { value: "team", label: "Team / alle" },
                      ],
                    },
                  ]
                : []),
              {
                name: "status",
                label: "Alle Status",
                options: ["submitted", "approved", "rejected", "cancelled"].map((value) => ({
                  value,
                  label: statusLabel(value),
                })),
              },
            ]}
          />

          {data.items.length === 0 ? (
            <EmptyState title="Keine Anträge" detail="Für diese Auswahl liegen keine Abwesenheiten vor." />
          ) : (
            <ul className="space-y-3">
              {data.items.map((absence) => {
                const isOwn = absence.employeeUsername === session.username;
                const canDecide = scope === "team" && absence.status === "submitted" && !isOwn;

                return (
                  <li key={absence.id} className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {formatDate(absence.startDate)} – {formatDate(absence.endDate)}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {statusLabel(absence.type)} · {absence.workingDays} Arbeitstage
                          {scope === "team" ? ` · ${absence.employee}` : ""}
                        </p>
                        {absence.note ? <p className="mt-1 text-sm text-slate-700">{absence.note}</p> : null}
                        {absence.decidedBy ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Entschieden von {absence.decidedBy} am {formatDate(absence.decidedAt)}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={absence.status} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {canDecide ? (
                        <>
                          <ActionButton
                            variant="success"
                            action={decideAbsenceAction.bind(null, absence.id, true, undefined)}
                          >
                            Genehmigen
                          </ActionButton>
                          <ActionButton
                            variant="danger"
                            confirm="Antrag ablehnen?"
                            action={decideAbsenceAction.bind(null, absence.id, false, undefined)}
                          >
                            Ablehnen
                          </ActionButton>
                        </>
                      ) : null}

                      {isOwn && ["submitted", "approved"].includes(absence.status) ? (
                        <ActionButton
                          variant="ghost"
                          confirm="Antrag stornieren?"
                          action={cancelAbsenceAction.bind(null, absence.id)}
                        >
                          Stornieren
                        </ActionButton>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
