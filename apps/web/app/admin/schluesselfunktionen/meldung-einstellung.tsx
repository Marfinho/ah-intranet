"use client";

import { useTransition } from "react";
import { VERTRETUNGS_MELDUNGEN, type VertretungsMeldung } from "@ah-intranet/shared";
import { setzeVertretungsMeldungAction } from "@/lib/actions";

/** Einstellung der Hausadministration: wann Vertretungen eine Mail bekommen. */
export function MeldungEinstellung({ aktuell }: { aktuell: VertretungsMeldung }) {
  const [pending, startTransition] = useTransition();
  const gewaehlt = VERTRETUNGS_MELDUNGEN.find((eintrag) => eintrag.key === aktuell);

  return (
    <label className="block text-sm font-medium text-slate-700">
      Meldung an Vertretungen
      <select
        defaultValue={aktuell}
        disabled={pending}
        onChange={(event) =>
          startTransition(async () => {
            const result = await setzeVertretungsMeldungAction(event.target.value);
            if (!result.ok && result.message) {
              window.alert(result.message);
            }
          })
        }
        className="mt-2 block w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
      >
        {VERTRETUNGS_MELDUNGEN.map((eintrag) => (
          <option key={eintrag.key} value={eintrag.key}>
            {eintrag.name}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs font-normal text-slate-500">
        {gewaehlt?.beschreibung}. Die Meldung nennt nur „abwesend", nie den Grund. Mails gehen nur, wenn der
        Mailversand eingerichtet ist.
      </span>
    </label>
  );
}
