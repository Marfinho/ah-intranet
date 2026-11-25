"use client";

import { useState, useTransition } from "react";
import { WOCHENTAGE, type SchichtartItem } from "@ah-intranet/shared";
import { deleteSchichtartAction } from "@/lib/actions";
import { SchichtartFormular, type Auswahl } from "./schichtart-formular";

export function SchichtartZeile({
  art,
  standorte,
  abteilungen,
  teams,
}: {
  art: SchichtartItem;
  standorte: Auswahl[];
  abteilungen: Auswahl[];
  teams: Auswahl[];
}) {
  const [offen, setOffen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{art.name}</p>
            <span className="badge bg-slate-100 text-slate-700">
              {art.startZeit}–{art.endZeit} Uhr
            </span>
            {!art.aktiv ? <span className="badge bg-slate-200 text-slate-600">inaktiv</span> : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {art.bereich} · mindestens {art.mindestBesetzung}, ideal {art.idealBesetzung} · Pause {art.pauseMinuten}{" "}
            Min.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {WOCHENTAGE.filter((tag) => art.tage.includes(tag.nummer))
              .map((tag) => tag.kurz)
              .join(", ")}
            {art.beiSondertag ? " · auch an Sondertagen" : ""}
          </p>
          {art.befunde.map((befund) => (
            <p
              key={befund.text}
              className={`mt-2 rounded-xl px-3 py-2 text-xs ${
                befund.schwere === "verstoss" ? "bg-rose-50 text-rose-900" : "bg-amber-50 text-amber-900"
              }`}
            >
              {befund.schwere === "verstoss" ? "Verstoß: " : "Hinweis: "}
              {befund.text}
            </p>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOffen((wert) => !wert)}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            {offen ? "Schließen" : "Bearbeiten"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Schichtart "${art.name}" löschen? Bereits geplante Schichten bleiben bestehen.`)) {
                startTransition(async () => {
                  const result = await deleteSchichtartAction(art.id);
                  if (!result.ok && result.message) {
                    window.alert(result.message);
                  }
                });
              }
            }}
            className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-40"
          >
            Löschen
          </button>
        </div>
      </div>
      {offen ? (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <SchichtartFormular art={art} standorte={standorte} abteilungen={abteilungen} teams={teams} />
        </div>
      ) : null}
    </li>
  );
}
