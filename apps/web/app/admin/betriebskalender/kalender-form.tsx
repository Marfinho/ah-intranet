"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { BETRIEBSTAG_ARTEN } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createBetriebstagAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/** Eigenen Tag eintragen: Brückentag, verkaufsoffener Sonntag, Betriebsurlaub, Hausmesse. */
export function KalenderForm({ standorte, jahr }: { standorte: { id: string; name: string }[]; jahr: number }) {
  const [state, formAction] = useFormState(createBetriebstagAction, initialState);
  const [art, setArt] = useState(BETRIEBSTAG_ARTEN[2].key);
  const [ganzesHaus, setGanzesHaus] = useState(true);
  const vorbelegt = BETRIEBSTAG_ARTEN.find((eintrag) => eintrag.key === art)!;

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Datum *">
        <input
          name="datum"
          type="date"
          required
          defaultValue={`${jahr}-01-01`}
          min={`${jahr}-01-01`}
          max={`${jahr}-12-31`}
          className={inputClass}
        />
      </Field>

      <Field label="Art *" hint={vorbelegt.beschreibung}>
        <select
          name="art"
          value={art}
          onChange={(event) => setArt(event.target.value as typeof art)}
          className={inputClass}
        >
          {BETRIEBSTAG_ARTEN.map((eintrag) => (
            <option key={eintrag.key} value={eintrag.key}>
              {eintrag.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Bezeichnung *" hint="z. B. Frühlingsfest, Inventur, Brückentag">
        <input name="name" required minLength={2} maxLength={80} className={inputClass} />
      </Field>

      <fieldset className="md:col-span-2">
        <legend className="text-sm font-medium text-slate-700">Gilt für</legend>
        <label className="mt-2 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="ganzesHaus"
            checked={ganzesHaus}
            onChange={(event) => setGanzesHaus(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="font-medium text-slate-800">Alle Standorte</span>
            <span className="block text-xs text-slate-500">
              Ein Eintrag für das ganze Haus, auch für später angelegte Standorte.
            </span>
          </span>
        </label>
        {ganzesHaus ? null : (
          <div className="mt-3">
            <p className="text-xs text-slate-500">Mehrere Standorte möglich - jeder erhält einen eigenen Eintrag.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {standorte.map((standort) => (
                <label
                  key={standort.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <input type="checkbox" name="locationIds" value={standort.id} className="h-4 w-4" />
                  {standort.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {/* key: beim Wechsel der Art springt die Vorbelegung mit, bleibt aber änderbar. */}
      <label key={art} className="flex items-start gap-3 text-sm md:col-span-2">
        <input
          type="checkbox"
          name="arbeitsfrei"
          defaultChecked={vorbelegt.arbeitsfreiStandard}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="font-medium text-slate-800">Arbeitsfrei</span>
          <span className="block text-xs text-slate-500">
            Zählt nicht als Arbeitstag bei Urlaub und Schichtplanung. Abwählen für Tage, an denen trotz Sonntag oder
            Feiertag gearbeitet wird.
          </span>
        </span>
      </label>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>
      <div className="md:col-span-2">
        <SubmitButton>Eintragen</SubmitButton>
      </div>
    </form>
  );
}
