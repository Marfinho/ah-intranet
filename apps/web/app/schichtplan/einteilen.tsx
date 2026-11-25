"use client";

import { useState, useTransition } from "react";
import { deleteShiftAction, einteilenAction } from "@/lib/actions";

/**
 * Eine Schicht von Hand einteilen, umbesetzen oder entfernen.
 *
 * Hier gilt keine Obergrenze für Wochenstunden: wer länger arbeiten soll als
 * vereinbart, wird einfach eingeteilt. Gesperrt ist nur die Doppelbelegung; die
 * Mehrarbeit erscheint danach als Hinweis im Plan.
 */
export function Einteilen({
  shiftId,
  assigneeId,
  people,
}: {
  shiftId: string;
  assigneeId: string | null;
  people: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [auswahl, setAuswahl] = useState(assigneeId ?? "");
  const [offen, setOffen] = useState(false);
  const melde = (result: { ok: boolean; message?: string }) => {
    if (!result.ok && result.message) {
      window.alert(result.message);
    }
  };

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="text-xs font-semibold text-brand-700 hover:underline"
      >
        {assigneeId ? "Umbesetzen" : "Einteilen"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={auswahl}
        disabled={pending}
        onChange={(event) => setAuswahl(event.target.value)}
        aria-label="Person einteilen"
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
      >
        <option value="">– offen –</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || auswahl === (assigneeId ?? "")}
        onClick={() =>
          startTransition(async () => {
            const result = await einteilenAction(shiftId, auswahl);
            melde(result);
            if (result.ok) setOffen(false);
          })
        }
        className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
      >
        Speichern
      </button>
      <button
        type="button"
        onClick={() => setOffen(false)}
        className="text-xs font-semibold text-slate-600 hover:underline"
      >
        Abbrechen
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Diese Schicht entfernen?")) {
            startTransition(async () => melde(await deleteShiftAction(shiftId)));
          }
        }}
        className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-40"
      >
        Schicht entfernen
      </button>
    </div>
  );
}
