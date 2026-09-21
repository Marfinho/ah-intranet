"use client";

import { useState, useTransition } from "react";
import type { PlatformSupportTicketSummary, SessionUser } from "@ah-intranet/shared";
import { CommentForm } from "@/components/comment-form";
import { platformSupportMessageAction, updatePlatformSupportTicketAction } from "@/lib/actions";

/**
 * Status, Zuweisung und Antwort einer Anfrage im Posteingang der Plattform.
 *
 * Zuweisung als einfaches "Übernehmen/Freigeben" statt einer Auswahlliste:
 * eine Liste aller Personen mit Plattformrechten wäre ein weiterer, nur dem
 * Betreiber zugänglicher Aufruf gewesen - "Übernehmen" kommt ohne aus.
 */
export function PlatformTicketControls({
  ticket,
  currentUserId,
}: {
  ticket: PlatformSupportTicketSummary;
  currentUserId: SessionUser["id"];
}) {
  const [pending, startTransition] = useTransition();
  const [internal, setInternal] = useState(false);

  function update(patch: { status?: string; assigneeId?: string | null }) {
    startTransition(async () => {
      const result = await updatePlatformSupportTicketAction(ticket.id, patch);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    });
  }

  const mine = ticket.assigneeId === currentUserId;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-slate-500">
          Status
          <select
            defaultValue={ticket.status}
            disabled={pending}
            onChange={(event) => update({ status: event.target.value })}
            className="ml-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
          >
            <option value="offen">Offen</option>
            <option value="in_bearbeitung">In Bearbeitung</option>
            <option value="wartet_auf_rueckmeldung">Wartet auf Rückmeldung</option>
            <option value="geloest">Gelöst</option>
          </select>
        </label>

        {mine ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => update({ assigneeId: null })}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Zuweisung aufheben
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => update({ assigneeId: currentUserId })}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Anfrage übernehmen
          </button>
        )}
      </div>

      {ticket.status !== "geloest" ? (
        <div className="space-y-2">
          <CommentForm
            action={platformSupportMessageAction.bind(null, ticket.id, internal)}
            placeholder={internal ? "Interne Notiz für das Support-Team …" : "Antwort an das Haus schreiben …"}
            label={internal ? "Notiz speichern" : "Antworten"}
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
            Nur intern sichtbar (das Haus sieht diese Nachricht nicht)
          </label>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Diese Anfrage ist gelöst und geschlossen.</p>
      )}
    </div>
  );
}
