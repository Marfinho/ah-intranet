"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Minimaler, gezielter Hinweis an einer einzelnen Stelle der Oberfläche -
 * bewusst kein mehrseitiger Rundgang. Nur exemplarisch einsetzen, wo eine
 * Person sonst nicht von selbst auf eine Funktion stößt.
 */
export function KontextHilfe({ text }: { text: string }) {
  const [offen, setOffen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOffen((wert) => !wert)}
        onBlur={() => setOffen(false)}
        aria-label="Hinweis anzeigen"
        aria-expanded={offen}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:text-brand-700"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {offen ? (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-card"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
