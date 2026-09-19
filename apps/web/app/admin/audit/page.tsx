import type { AuditLogItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireModule, requirePermission } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export default async function AuditPage({ searchParams }: { searchParams: { search?: string; action?: string } }) {
  await requireModule("audit");
  await requirePermission("audit.read");

  const query = new URLSearchParams();
  if (searchParams.search) query.set("search", searchParams.search);
  if (searchParams.action) query.set("action", searchParams.action);

  const entries = await apiGet<AuditLogItem[]>(`/audit?${query.toString()}`);
  const actions = [...new Set(entries.map((entry) => entry.action))].sort();

  return (
    <AppShell title="Audit-Log" subtitle="Nachvollziehbare Protokollierung aller relevanten Aktionen">
      <Section title={`${entries.length} Ereignisse`} subtitle="Die jüngsten 200 Einträge">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Aktion, Person oder Detail"
            selects={[
              {
                name: "action",
                label: "Alle Aktionen",
                options: actions.map((value) => ({ value, label: value })),
              },
            ]}
          />

          {entries.length === 0 ? (
            <EmptyState title="Keine Einträge" detail="Für diese Filter wurde nichts protokolliert." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Zeitpunkt</th>
                    <th className="px-4 py-3 font-semibold">Person</th>
                    <th className="px-4 py-3 font-semibold">Aktion</th>
                    <th className="px-4 py-3 font-semibold">Objekt</th>
                    <th className="px-4 py-3 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(entry.createdAt)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{entry.actor}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{entry.action}</td>
                      <td className="px-4 py-3 text-slate-600">{entry.entityType}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
