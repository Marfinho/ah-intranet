"use client";

import { useState, useTransition } from "react";
import type { PlatformStaffSummary } from "@ah-intranet/shared";
import { searchPlatformStaffAction } from "@/lib/actions";
import { inputClass } from "@/components/forms";
import { StaffPermissionEditor } from "./staff-permission-editor";

/**
 * Freischalten eines neuen Kontos.
 *
 * Die Suche läuft über alle Häuser - ein Konto der Plattformverwaltung ist ein
 * gewöhnliches Benutzerkonto irgendeines Hauses, nicht ein eigener Kontotyp.
 * Ein gefundenes Konto erscheint als normaler Rechte-Editor mit leerer
 * Auswahl; das Speichern erledigt derselbe Weg wie bei bestehenden Konten.
 */
export function StaffSearch({ existingIds }: { existingIds: string[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlatformStaffSummary[]>([]);
  const [chosen, setChosen] = useState<PlatformStaffSummary[]>([]);
  const [pending, startTransition] = useTransition();

  function search(value: string) {
    setQuery(value);
    startTransition(async () => {
      setResults(value.trim().length >= 2 ? await searchPlatformStaffAction(value) : []);
    });
  }

  const bekannt = new Set([...existingIds, ...chosen.map((entry) => entry.id)]);

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium text-slate-700">
        Konto suchen
        <input
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder="Name, Benutzername oder E-Mail, über alle Häuser"
          className={inputClass}
        />
      </label>

      {pending ? <p className="text-sm text-slate-500">Sucht …</p> : null}

      {results.filter((entry) => !bekannt.has(entry.id)).length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {results
            .filter((entry) => !bekannt.has(entry.id))
            .map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{entry.displayName}</p>
                  <p className="text-xs text-slate-500">
                    {entry.username} · {entry.tenant.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setChosen((current) => [...current, entry]);
                    setResults((current) => current.filter((item) => item.id !== entry.id));
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Auswählen
                </button>
              </li>
            ))}
        </ul>
      ) : null}

      {chosen.map((entry) => (
        <StaffPermissionEditor key={entry.id} staff={entry} />
      ))}
    </div>
  );
}
