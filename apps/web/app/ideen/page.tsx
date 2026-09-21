import type { Idea } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section, StatusBadge, statusLabel } from "@/components/ui";
import { IdeaComposer } from "./idea-composer";
import { IdeaCard } from "./idea-card";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";

interface IdeasResponse {
  items: Idea[];
  canManage: boolean;
}

export default async function IdeasPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  await requireModule("ideas");

  const query = new URLSearchParams();
  if (searchParams.status) query.set("status", searchParams.status);
  if (searchParams.search) query.set("search", searchParams.search);

  const data = await apiGet<IdeasResponse>(`/ideas?${query.toString()}`);

  return (
    <AppShell title="Ideenmanagement" subtitle="Verbesserungsvorschläge einreichen, bewerten und verfolgen">
      <Section title="Neue Idee einreichen" subtitle="Je konkreter der Vorschlag, desto schneller die Bewertung">
        <IdeaComposer />
      </Section>

      <Section title={`${data.items.length} Ideen`} subtitle="Sortiert nach Zustimmung">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Idee suchen"
            selects={[
              {
                name: "status",
                label: "Alle Status",
                options: ["neu", "in_pruefung", "angenommen", "umgesetzt", "abgelehnt"].map((value) => ({
                  value,
                  label: statusLabel(value),
                })),
              },
            ]}
          />

          {data.items.length === 0 ? (
            <EmptyState title="Noch keine Ideen" detail="Machen Sie den Anfang und reichen Sie einen Vorschlag ein." />
          ) : (
            <ul className="space-y-3">
              {data.items.map((idea) => (
                <li key={idea.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <IdeaCard idea={idea} canManage={data.canManage} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge bg-slate-100 text-slate-600">{idea.category}</span>
                        <StatusBadge status={idea.status} />
                      </div>
                      <p className="mt-2 font-semibold text-slate-900">{idea.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{idea.description}</p>
                      {idea.decisionNote ? (
                        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                          Rückmeldung: {idea.decisionNote}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-500">Eingereicht von {idea.author}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
