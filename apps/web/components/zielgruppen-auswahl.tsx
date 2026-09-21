"use client";

import { useState } from "react";
import {
  GLOBAL_SCOPE,
  ZIELGRUPPEN_STUFEN,
  ZIELGRUPPEN_STUFEN_LABELS,
  zielgruppeLabel,
  zielgruppenToken,
} from "@ah-intranet/shared";
import type { Zielgruppe, ZielgruppenKatalog, ZielgruppenStufe } from "@ah-intranet/shared";
import { inputClass } from "./forms";
import { cn } from "@/lib/utils";

/**
 * Auswahl der Zielgruppe: Alle → Standort → Abteilung → Fachbereich.
 *
 * Bewusst keine flache Liste zum Ankreuzen. Eine Gruppe mit acht Häusern und
 * zwölf Abteilungen hätte dort hundert Kästchen, und „Service in Bremen" wäre
 * gar nicht ausdrückbar - zwei Haken hießen „ganz Bremen **oder** der gesamte
 * Service". Hier wird eine Zielgruppe zusammengestellt und hinzugefügt; mehrere
 * davon stehen nebeneinander.
 */
export function ZielgruppenAuswahl({
  katalog,
  name = "audienceScopes",
  vorbelegt = [],
}: {
  katalog: ZielgruppenKatalog;
  name?: string;
  vorbelegt?: string[];
}) {
  const nurGlobal = !vorbelegt.length || vorbelegt.includes(GLOBAL_SCOPE);
  const [alle, setAlle] = useState(nurGlobal);
  const [gewaehlt, setGewaehlt] = useState<string[]>(nurGlobal ? [] : vorbelegt);
  const [entwurf, setEntwurf] = useState<Zielgruppe>({});

  const eintraege = (stufe: ZielgruppenStufe) => katalog.eintraege.filter((eintrag) => eintrag.stufe === stufe);
  const stufen = ZIELGRUPPEN_STUFEN.filter((stufe) => eintraege(stufe).length > 0);
  const token = zielgruppenToken(entwurf);
  const kannHinzufuegen = token !== GLOBAL_SCOPE && !gewaehlt.includes(token);

  const hinzufuegen = () => {
    if (!kannHinzufuegen) {
      return;
    }
    setGewaehlt([...gewaehlt, token]);
    setEntwurf({});
  };

  return (
    <div className="grid gap-3">
      {/* Was gesendet wird. „Alle" ist ein Token, keine leere Auswahl - sonst
          hinge die Bedeutung am Verhalten des Servers. */}
      {(alle || !gewaehlt.length ? [GLOBAL_SCOPE] : gewaehlt).map((wert) => (
        <input key={wert} type="hidden" name={name} value={wert} />
      ))}

      <div className="flex flex-wrap gap-2">
        {[
          { wert: true, label: "Alle Mitarbeitenden" },
          { wert: false, label: "Eingrenzen" },
        ].map((option) => (
          <label
            key={String(option.wert)}
            className={cn(
              "ziel cursor-pointer rounded-xl border px-4 text-sm font-semibold",
              alle === option.wert ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-700",
            )}
          >
            <input
              type="radio"
              name={`${name}-modus`}
              className="sr-only"
              checked={alle === option.wert}
              onChange={() => setAlle(option.wert)}
            />
            {option.label}
          </label>
        ))}
      </div>

      {alle ? (
        <p className="text-xs text-slate-600">Der Inhalt erscheint in jedem Haus der Gruppe, in jeder Abteilung.</p>
      ) : (
        <div className="grid gap-3 rounded-2xl border border-slate-300 p-4">
          <div className="grid gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
            {stufen.map((stufe) => (
              <label key={stufe} className="text-xs font-medium text-slate-700">
                {ZIELGRUPPEN_STUFEN_LABELS[stufe]}
                <select
                  className={inputClass}
                  value={entwurf[stufe] ?? ""}
                  onChange={(event) => setEntwurf({ ...entwurf, [stufe]: event.target.value || undefined })}
                >
                  <option value="">alle</option>
                  {eintraege(stufe).map((eintrag) => (
                    <option key={eintrag.code} value={eintrag.code}>
                      {eintrag.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              type="button"
              onClick={hinzufuegen}
              disabled={!kannHinzufuegen}
              className="ziel rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              Hinzufügen
            </button>
          </div>

          {token !== GLOBAL_SCOPE ? (
            <p className="text-xs text-slate-600">
              Wird hinzugefügt: <strong>{zielgruppeLabel(token, katalog)}</strong>
            </p>
          ) : null}

          {gewaehlt.length ? (
            <ul className="flex flex-wrap gap-2">
              {gewaehlt.map((wert) => (
                <li key={wert}>
                  <button
                    type="button"
                    onClick={() => setGewaehlt(gewaehlt.filter((eintrag) => eintrag !== wert))}
                    className="ziel rounded-full border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-700"
                    aria-label={`${zielgruppeLabel(wert, katalog)} entfernen`}
                  >
                    {zielgruppeLabel(wert, katalog)} <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-600">
              Noch keine Zielgruppe gewählt – so gespeichert gilt der Inhalt für alle.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
