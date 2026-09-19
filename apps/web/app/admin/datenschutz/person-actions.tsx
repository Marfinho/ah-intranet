"use client";

import { useState, useTransition } from "react";
import type { EmployeeDirectoryEntry } from "@ah-intranet/shared";
import { personLoeschenAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Betroffenenrechte je Person.
 *
 * Die Auskunft geht als Datei heraus, damit sie unverändert weitergegeben werden
 * kann. Die Löschung verlangt einen Anlass und eine Bestätigung - sie ist
 * unumkehrbar und muss belegbar bleiben.
 */
export function PersonActions({ person }: { person: EmployeeDirectoryEntry }) {
  const [pending, startTransition] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);

  if (person.status === "deleted") {
    return <span className="text-xs text-slate-500">bereits anonymisiert</span>;
  }

  function loeschen() {
    const anlass = window.prompt(
      `Anonymisierung von ${person.displayName}\n\nDer Vorgang ist unumkehrbar. Bestellungen und Freigaben bleiben aufbewahrungspflichtig erhalten, verlieren aber den Personenbezug.\n\nAnlass festhalten (z. B. "Löschverlangen vom 12.03.2026"):`,
    );
    if (!anlass || anlass.trim().length < 3) {
      return;
    }

    startTransition(async () => {
      const result = await personLoeschenAction(person.id, anlass.trim());
      setMeldung(result.ok ? (result.detail ?? "Anonymisiert.") : (result.message ?? "Fehlgeschlagen."));
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {meldung ? <span className="text-xs text-slate-600">{meldung}</span> : null}
      <a
        href={`/admin/datenschutz/auskunft/${person.id}`}
        className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
      >
        Auskunft
      </a>
      <button
        type="button"
        onClick={loeschen}
        disabled={pending}
        className={cn(
          "rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100",
          pending && "cursor-not-allowed opacity-60",
        )}
      >
        Anonymisieren
      </button>
    </div>
  );
}
