"use client";

import { useState, useTransition } from "react";
import type { CustodyItemSummary } from "@ah-intranet/shared";
import { discardCustodyAction, handOutCustodyAction, takeBackCustodyAction, type ActionState } from "@/lib/actions";

/**
 * Übergabe und Rücknahme.
 *
 * Zwei Wege zur Empfängerin: ein Konto des Hauses oder ein freier Name - eine
 * Kundin, die ihr Handy abholt, hat kein Konto. Ohne den zweiten Weg würde die
 * Übergabe gar nicht erst festgehalten.
 */
export function CustodyActions({ item, people }: { item: CustodyItemSummary; people: { id: string; name: string }[] }) {
  const [offen, setOffen] = useState(false);
  const [personId, setPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const melde = (result: ActionState) => {
    if (!result.ok && result.message) {
      window.alert(result.message);
    } else {
      setOffen(false);
      setPersonId("");
      setPersonName("");
      setNote("");
    }
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        {item.status === "verwahrt" ? (
          <button
            type="button"
            onClick={() => setOffen((wert) => !wert)}
            className="ziel rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {item.kind === "schluessel" ? "Ausgeben" : "Abholung buchen"}
          </button>
        ) : null}

        {item.status === "ausgegeben" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => melde(await takeBackCustodyAction(item.id)))}
            className="ziel rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Zurücknehmen
          </button>
        ) : null}

        {item.status === "verwahrt" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const grund = window.prompt("Warum wird der Eintrag entsorgt?") ?? undefined;
              if (grund !== undefined) {
                startTransition(async () => melde(await discardCustodyAction(item.id, grund)));
              }
            }}
            className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50"
          >
            Entsorgen
          </button>
        ) : null}
      </div>

      {offen ? (
        <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-3">
          <label className="text-sm">
            <span className="font-medium text-slate-700">Konto im Haus</span>
            <select
              value={personId}
              onChange={(event) => {
                setPersonId(event.target.value);
                if (event.target.value) setPersonName("");
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">– keines –</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="font-medium text-slate-700">oder Name</span>
            <input
              value={personName}
              onChange={(event) => {
                setPersonName(event.target.value);
                if (event.target.value) setPersonId("");
              }}
              placeholder="z. B. Frau Özdemir, Kundin"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium text-slate-700">Notiz</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="md:col-span-3">
            <button
              type="button"
              disabled={pending || (!personId && !personName.trim())}
              onClick={() =>
                startTransition(async () =>
                  melde(
                    await handOutCustodyAction(item.id, {
                      personId: personId || undefined,
                      personName: personName.trim() || undefined,
                      note: note.trim() || undefined,
                    }),
                  ),
                )
              }
              className="ziel rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              Übergabe festhalten
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
