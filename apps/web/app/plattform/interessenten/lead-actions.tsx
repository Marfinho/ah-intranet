"use client";

import { useState, useTransition } from "react";
import { ActionButton } from "@/components/forms";
import { neuerLeadLinkAction, setLeadStatusAction, type ActionState } from "@/lib/actions";
import { LEAD_STATUS, LEAD_STATUS_LABELS, type LeadStatusKey } from "@ah-intranet/shared";

/** Status, Link und Löschen eines Interessenten. */
export function LeadActions({
  id,
  status,
  widerruf,
  loeschen,
}: {
  id: string;
  status: LeadStatusKey;
  widerruf: () => Promise<ActionState>;
  loeschen: () => Promise<ActionState>;
}) {
  const [neuerLink, setNeuerLink] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700" htmlFor="lead-status">
          Status
        </label>
        <select
          id="lead-status"
          defaultValue={status}
          disabled={pending}
          onChange={(e) => start(async () => void (await setLeadStatusAction(id, e.target.value)))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {LEAD_STATUS.map((eintrag) => (
            <option key={eintrag} value={eintrag}>
              {LEAD_STATUS_LABELS[eintrag]}
            </option>
          ))}
        </select>

        <ActionButton
          variant="ghost"
          confirm="Einen neuen Link erzeugen? Der bisherige hört sofort auf zu gelten."
          action={async () => {
            const ergebnis = await neuerLeadLinkAction(id);
            setNeuerLink(ergebnis.detail ?? null);
            return ergebnis;
          }}
        >
          Neuen Link erzeugen
        </ActionButton>
        <ActionButton
          variant="ghost"
          confirm="Den Link widerrufen? Die Pitch-Seite ist danach nicht mehr erreichbar."
          action={widerruf}
        >
          Link widerrufen
        </ActionButton>
        <ActionButton variant="danger" confirm="Interessent samt Häusern endgültig löschen?" action={loeschen}>
          Löschen
        </ActionButton>
      </div>

      {neuerLink ? (
        <div
          role="status"
          className="break-all rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {neuerLink}
        </div>
      ) : null}
    </div>
  );
}
