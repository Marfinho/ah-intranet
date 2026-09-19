import type { EmployeeDirectoryEntry, TicketSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { TicketComposer } from "./ticket-composer";
import { TicketRow } from "./ticket-row";
import { apiGet, apiGetSafe } from "@/lib/api";
import { isManaging, requireModule } from "@/lib/session";

interface TicketsResponse {
  items: TicketSummary[];
  canManage: boolean;
}

const CATEGORIES = [
  { value: "it", label: "IT" },
  { value: "facility", label: "Facility" },
  { value: "hr", label: "Personal" },
  { value: "marketing", label: "Marketing" },
];

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { scope?: string; status?: string; category?: string; search?: string; von?: string };
}) {
  const session = await requireModule("tickets");

  const query = new URLSearchParams();
  if (searchParams.scope) query.set("scope", searchParams.scope);
  if (searchParams.status) query.set("status", searchParams.status);
  if (searchParams.category) query.set("category", searchParams.category);
  if (searchParams.search) query.set("search", searchParams.search);

  const data = await apiGet<TicketsResponse>(`/tickets?${query.toString()}`);

  // Zuweisung ist nur für Verwaltende relevant; sonst sparen wir uns die Abfrage.
  const assignees = isManaging(session)
    ? await apiGetSafe<EmployeeDirectoryEntry[]>("/users", []).then((users) =>
        users.map((user) => ({ id: user.id, name: user.displayName })),
      )
    : [];

  return (
    <AppShell title="Serviceanfragen" subtitle="Interne Tickets an IT, Facility, Personal, Marketing und Fuhrpark">
      <Section title="Neue Anfrage" subtitle="Beschreiben Sie Ihr Anliegen möglichst konkret">
        <TicketComposer
          vorgabe={
            searchParams.von
              ? {
                  titel: "Rückmeldung aus der Erprobung",
                  beschreibung: `Seite: ${searchParams.von}\n\nWas ist passiert?\n\nWas hatten Sie erwartet?\n`,
                }
              : undefined
          }
        />
      </Section>

      <Section title={`${data.items.length} Tickets`} subtitle="Nach Status, Kategorie und Stichwort filtern">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Titel, Nummer oder Beschreibung"
            selects={[
              {
                name: "status",
                label: "Alle Status",
                options: [
                  { value: "offen", label: "Offen" },
                  { value: "in_bearbeitung", label: "In Bearbeitung" },
                  { value: "wartet_auf_rueckmeldung", label: "Wartet auf Rückmeldung" },
                  { value: "geloest", label: "Gelöst" },
                ],
              },
              { name: "category", label: "Alle Kategorien", options: CATEGORIES },
              ...(data.canManage
                ? [
                    {
                      name: "scope",
                      label: "Alle Tickets",
                      options: [
                        { value: "all", label: "Alle Tickets" },
                        { value: "mine", label: "Nur meine" },
                      ],
                    },
                  ]
                : []),
            ]}
          />

          {data.items.length === 0 ? (
            <EmptyState title="Keine Tickets" detail="Für diese Auswahl liegen keine Serviceanfragen vor." />
          ) : (
            <ul className="space-y-3">
              {data.items.map((ticket) => (
                <li key={ticket.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{ticket.number}</span>
                        <PriorityBadge priority={ticket.priority} />
                        <span className="badge bg-slate-100 text-slate-600">{ticket.category}</span>
                      </div>
                      <p className="mt-2 font-medium text-slate-900">{ticket.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{ticket.description}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {ticket.requester} · zugewiesen an {ticket.assignee ?? "niemanden"}
                        {ticket.commentCount > 0 ? ` · ${ticket.commentCount} Beiträge` : ""}
                      </p>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>

                  <TicketRow ticket={ticket} canManage={data.canManage} assignees={assignees} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
