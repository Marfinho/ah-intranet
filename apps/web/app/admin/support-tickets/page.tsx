import Link from "next/link";
import type { PlatformSupportTicketSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { hasPlatformPermission, requireSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function PlatformSupportPage({
  searchParams,
}: {
  searchParams: { status?: string; search?: string };
}) {
  const session = await requireSession();
  if (!hasPlatformPermission(session, "support.tickets.view")) {
    redirect("/admin");
  }

  const query = new URLSearchParams();
  if (searchParams.status) query.set("status", searchParams.status);
  if (searchParams.search) query.set("search", searchParams.search);

  const tickets = await apiGet<PlatformSupportTicketSummary[]>(`/plattform/support-tickets?${query.toString()}`);

  return (
    <AppShell title="Support-Posteingang" subtitle="Anfragen aller Häuser an die Plattformverwaltung">
      <Section title={`${tickets.length} Anfragen`} subtitle="Nach Status und Stichwort filtern">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Nummer, Betreff, Haus"
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
            ]}
          />

          {tickets.length === 0 ? (
            <EmptyState title="Keine Anfragen" detail="Für diese Auswahl liegen keine Support-Anfragen vor." />
          ) : (
            <ul className="space-y-3">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/admin/support-tickets/${ticket.id}`}
                    className="block rounded-2xl border border-slate-200 p-5 transition hover:border-brand-100 hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{ticket.number}</span>
                          <PriorityBadge priority={ticket.priority} />
                          <span className="badge bg-slate-100 text-slate-600">{ticket.tenant.name}</span>
                        </div>
                        <p className="mt-2 font-medium text-slate-900">{ticket.subject}</p>
                        <p className="mt-1 text-sm text-slate-600">{ticket.description}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {ticket.requester} · {formatDateTime(ticket.createdAt)} · zugewiesen an{" "}
                          {ticket.assignee ?? "niemanden"}
                          {ticket.messageCount > 0 ? ` · ${ticket.messageCount} Nachrichten` : ""}
                        </p>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
