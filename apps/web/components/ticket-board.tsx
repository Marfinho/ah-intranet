import type { TicketSummary } from "@ah-intranet/shared";
import { formatDate } from "@/lib/utils";

export function TicketBoard({ tickets }: { tickets: TicketSummary[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tickets.map((ticket) => (
        <div key={ticket.id} className="rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-slate-900">{ticket.title}</p>
            <span className="badge bg-slate-100 text-slate-700">{ticket.status}</span>
          </div>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>Anfrage: {ticket.requester}</p>
            <p>Kategorie: {ticket.category}</p>
            <p>Priorität: {ticket.priority}</p>
            <p>Zuständig: {ticket.assignee}</p>
            <p>Erstellt: {formatDate(ticket.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
