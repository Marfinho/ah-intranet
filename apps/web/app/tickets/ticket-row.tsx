"use client";

import { useState, useTransition } from "react";
import type { TicketSummary } from "@ah-intranet/shared";
import { CommentForm } from "@/components/comment-form";
import { commentTicketAction, updateTicketAction } from "@/lib/actions";

/** Statuswechsel, Zuweisung und Verlauf direkt in der Ticketliste. */
export function TicketRow({
  ticket,
  canManage,
  assignees,
}: {
  ticket: TicketSummary;
  canManage: boolean;
  assignees: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(patch: { status?: string; assigneeId?: string | null }) {
    startTransition(async () => {
      const result = await updateTicketAction(ticket.id, patch);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    });
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        {canManage ? (
          <>
            <label className="text-xs font-medium text-slate-500">
              Status
              <select
                defaultValue={ticket.status}
                disabled={pending}
                onChange={(event) => update({ status: event.target.value })}
                className="ml-2 min-h-ziel rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
                aria-label={`Status von ${ticket.number}`}
              >
                <option value="offen">Offen</option>
                <option value="in_bearbeitung">In Bearbeitung</option>
                <option value="wartet_auf_rueckmeldung">Wartet auf Rückmeldung</option>
                <option value="geloest">Gelöst</option>
              </select>
            </label>

            <label className="text-xs font-medium text-slate-500">
              Zuweisung
              <select
                defaultValue=""
                disabled={pending}
                onChange={(event) => update({ assigneeId: event.target.value || null })}
                className="ml-2 min-h-ziel rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
                aria-label={`Zuweisung von ${ticket.number}`}
              >
                <option value="">— niemand —</option>
                {assignees.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="ziel rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {open ? "Verlauf schließen" : "Antworten"}
        </button>
      </div>

      {open ? (
        <div className="mt-4">
          <CommentForm
            action={commentTicketAction.bind(null, ticket.id)}
            placeholder="Antwort schreiben …"
            label="Antworten"
          />
        </div>
      ) : null}
    </div>
  );
}
