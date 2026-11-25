"use client";

import { useState, useTransition } from "react";
import type { SchluesselBesetzungEintrag } from "@ah-intranet/shared";
import { besetzeSchluesselAction, leereSchluesselAction } from "@/lib/actions";

function melde(result: { ok: boolean; message?: string }) {
  if (!result.ok && result.message) {
    window.alert(result.message);
  }
}

/** Eine Stufe einer Funktion: wer sie trägt, ob das trägt, und - mit Recht - Ändern und Freimachen. */
export function StufeZeile({
  funktion,
  stufe,
  stufenName,
  eintrag,
  kandidaten,
  darfPflegen,
}: {
  funktion: string;
  stufe: number;
  stufenName: string;
  eintrag: SchluesselBesetzungEintrag;
  /** Konten, die frei wären: ohne die, die in dieser Funktion schon eine andere Stufe tragen. */
  kandidaten: { id: string; name: string }[];
  darfPflegen: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [auswahl, setAuswahl] = useState(eintrag.userId ?? "");

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">{stufenName}</span>

      {darfPflegen ? (
        <>
          <select
            value={auswahl}
            disabled={pending}
            onChange={(event) => setAuswahl(event.target.value)}
            aria-label={`${stufenName} wählen`}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">– frei –</option>
            {kandidaten.map((kandidat) => (
              <option key={kandidat.id} value={kandidat.id}>
                {kandidat.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !auswahl || auswahl === eintrag.userId}
            onClick={() => startTransition(async () => melde(await besetzeSchluesselAction(funktion, stufe, auswahl)))}
            className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            Einsetzen
          </button>
          {eintrag.userId ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`${stufenName} wieder freimachen?`)) {
                  startTransition(async () => {
                    melde(await leereSchluesselAction(funktion, stufe));
                    setAuswahl("");
                  });
                }
              }}
              className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-40"
            >
              Freimachen
            </button>
          ) : null}
        </>
      ) : (
        <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{eintrag.name ?? "– frei –"}</span>
      )}

      {eintrag.userId && !eintrag.gueltig ? (
        <span className="badge bg-rose-100 text-rose-800" title="Konto inaktiv, ohne Zugang oder ohne das nötige Recht">
          zählt nicht
        </span>
      ) : null}
      {eintrag.abwesend ? <span className="badge bg-amber-100 text-amber-800">heute abwesend</span> : null}
    </li>
  );
}
