import Link from "next/link";
import { redirect } from "next/navigation";
import type { PlatformSupportTicketSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { apiGet } from "@/lib/api";
import { hasPlatformPermission, requireSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { PlatformTicketControls } from "./platform-ticket-controls";

export default async function PlatformSupportTicketDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!hasPlatformPermission(session, "support.tickets.view")) {
    redirect("/admin");
  }

  const ticket = await apiGet<PlatformSupportTicketSummary>(`/plattform/support-tickets/${params.id}`);
  const canManage = hasPlatformPermission(session, "support.tickets.manage");

  return (
    <AppShell title={`${ticket.number} · ${ticket.subject}`} subtitle={`Support-Anfrage von ${ticket.tenant.name}`}>
      <Link href="/admin/support-tickets" className="text-sm font-semibold text-slate-600 hover:underline">
        ← Zurück zum Posteingang
      </Link>

      <Section
        title="Anfrage"
        subtitle={`${ticket.requester} · ${ticket.tenant.name} · ${formatDateTime(ticket.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
        }
      >
        <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
      </Section>

      <Section title="Verlauf" subtitle="Nachrichten des Hauses und interne Notizen">
        <Timeline
          entries={(ticket.messages ?? []).map((message) => ({
            timestamp: formatDateTime(message.createdAt),
            title: `${message.author}${message.isInternal ? " · intern" : ""}`,
            detail: message.body,
          }))}
        />

        {canManage ? (
          <div className="mt-4">
            <PlatformTicketControls ticket={ticket} currentUserId={session.id} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Zum Antworten fehlt das Recht "Support-Anfragen bearbeiten".
          </p>
        )}
      </Section>
    </AppShell>
  );
}
