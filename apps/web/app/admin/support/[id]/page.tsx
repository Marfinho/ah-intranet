import Link from "next/link";
import type { SupportTicketSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { SupportReplyForm } from "../support-reply-form";

export default async function SupportTicketDetailPage({ params }: { params: { id: string } }) {
  await requirePermission("admin.access");

  const ticket = await apiGet<SupportTicketSummary>(`/support/tickets/${params.id}`);

  return (
    <AppShell title={`${ticket.number} · ${ticket.subject}`} subtitle="Support-Anfrage an AHOI">
      <Link href="/admin/support" className="text-sm font-semibold text-slate-600 hover:underline">
        ← Zurück zu allen Anfragen
      </Link>

      <Section
        title="Anfrage"
        subtitle={`${ticket.requester} · ${formatDateTime(ticket.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
        }
      >
        <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
        {ticket.assigned ? (
          <p className="mt-3 text-xs text-slate-500">Die Plattformverwaltung hat sich der Anfrage angenommen.</p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Noch niemandem zugewiesen.</p>
        )}
      </Section>

      <Section title="Verlauf" subtitle="Antworten von Ihnen und dem AHOI-Support">
        <Timeline
          entries={(ticket.messages ?? []).map((message) => ({
            timestamp: formatDateTime(message.createdAt),
            title: message.isStaffReply ? "AHOI-Support" : "Sie",
            detail: message.body,
          }))}
        />

        {ticket.status !== "geloest" ? (
          <div className="mt-4">
            <SupportReplyForm ticketId={ticket.id} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Diese Anfrage ist gelöst und geschlossen.</p>
        )}
      </Section>
    </AppShell>
  );
}
