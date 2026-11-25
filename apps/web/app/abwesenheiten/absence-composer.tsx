"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import type { ErfassbarePerson } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createAbsenceAction, type ActionState } from "@/lib/actions";
import { toDateInput } from "@/lib/utils";

const initialState: ActionState = { ok: true };

/**
 * Neuer Antrag - oder, für Führungskräfte, ein Eintrag für eine Person ihres Teams.
 *
 * Die Auswahl der Person erscheint nur, wenn die API welche nennt: sie kennt
 * die Unterstellungen, die Oberfläche rät nichts.
 */
export function AbsenceComposer({ erfassbar }: { erfassbar: ErfassbarePerson[] }) {
  const [state, formAction] = useFormState(createAbsenceAction, initialState);
  const [art, setArt] = useState("urlaub");
  const [fuerAndere, setFuerAndere] = useState(false);
  const today = toDateInput(new Date());
  const sofort = art === "krank" || fuerAndere;

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      {erfassbar.length > 0 ? (
        <Field label="Für" hint="Für Ihr Team eintragen - gilt sofort, ohne Freigabe" wide>
          <select
            name="userId"
            defaultValue=""
            onChange={(event) => setFuerAndere(event.target.value !== "")}
            className={inputClass}
          >
            <option value="">Für mich selbst</option>
            {erfassbar.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
                {person.hasAccess ? "" : " (ohne Zugang)"}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Art *">
        <select
          name="type"
          required
          value={art}
          onChange={(event) => setArt(event.target.value)}
          className={inputClass}
        >
          <option value="urlaub">Urlaub</option>
          <option value="krank">Krankmeldung</option>
          <option value="gleitzeit">Gleitzeit</option>
          <option value="sonderurlaub">Sonderurlaub</option>
          <option value="fortbildung">Fortbildung / Schulung</option>
        </select>
      </Field>

      <Field label="Anmerkung" hint="z. B. Vertretungsregelung - bei Krankmeldungen keine Diagnose angeben">
        <input name="note" className={inputClass} placeholder="optional" />
      </Field>

      <Field label="Von *">
        <input name="startDate" type="date" required defaultValue={today} className={inputClass} />
      </Field>

      <Field label="Bis *">
        <input name="endDate" type="date" required defaultValue={today} className={inputClass} />
      </Field>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="startHalb" className="h-4 w-4" />
        Erster Tag nur halb (bei einem Einzeltag: der halbe Tag)
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="endHalb" className="h-4 w-4" />
        Letzter Tag nur halb
      </label>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>{sofort ? "Eintragen" : "Antrag einreichen"}</SubmitButton>
        <p className="mt-2 text-xs text-slate-500">
          {sofort ? "Gilt sofort, ohne Freigabe." : "Geht zur Freigabe an Ihre Führungskraft."} Wochenenden und freie
          Tage aus dem Betriebskalender zählen nicht.
        </p>
      </div>
    </form>
  );
}
