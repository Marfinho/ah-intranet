"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uebernehmePlanAction } from "@/lib/actions";

export function UebernahmeKnopf({ von, bis, schichtartIds, anzahl }: { von: string; bis: string; schichtartIds: string[]; anzahl: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await uebernehmePlanAction(von, bis, schichtartIds);
            if (result.ok) {
              router.push("/schichtplan");
            } else {
              setMeldung(result.message ?? "Fehlgeschlagen");
            }
          })
        }
        className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Übernimmt …" : `${anzahl} Schicht(en) übernehmen`}
      </button>
      <p className="text-xs text-slate-500">Die Planung wird bei der Übernahme neu gerechnet; eingeteilte Personen werden benachrichtigt.</p>
      {meldung ? <p className="w-full rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">{meldung}</p> : null}
    </div>
  );
}
