import Link from "next/link";
import type { SupportTicketSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { SupportTicketComposer } from "./support-ticket-composer";

export default async function SupportPage() {
  await requirePermission("admin.access");

  const tickets = await apiGet<SupportTicketSummary[]>("/support/tickets");

  return (
    <AppShell
      title="AHOI-Support"
      subtitle="Support-Anfragen dieses Hauses an den Betreiber der Plattform"
    >
      <Section title="Neue Anfrage" subtitle="Beschreiben Sie Ihr Anliegen möglichst konkret">
        <SupportTicketComposer />
      </Section>

      <Section title={`${tickets.length} Anfragen`} subtitle="Verlauf dieses Hauses">
        {tickets.length === 0 ? (
          <EmptyState title="Noch keine Anfrage" detail="Support-Anfragen an AHOI erscheinen hier." />
        ) : (
          <ul className="space-y-3">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/admin/support/${ticket.id}`}
                  className="block rounded-2xl border border-slate-200 p-5 transition hover:border-brand-100 hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{ticket.number}</span>
                        <PriorityBadge priority={ticket.priority} />
                      </div>
                      <p className="mt-2 font-medium text-slate-900">{ticket.subject}</p>
                      <p className="mt-1 text-sm text-slate-600">{ticket.description}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {ticket.requester} · {formatDateTime(ticket.createdAt)}
                        {ticket.assigned ? " · wird bearbeitet" : ""}
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
      </Section>
    </AppShell>
  );
}
