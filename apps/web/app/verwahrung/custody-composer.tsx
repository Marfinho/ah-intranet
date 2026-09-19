"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createCustodyAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function CustodyComposer({ organisation }: { organisation: { locations: { id: string; name: string }[] } }) {
  const [state, formAction] = useFormState(createCustodyAction, initialState);
  const [kind, setKind] = useState<"fundsache" | "schluessel">("fundsache");

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Art *">
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as "fundsache" | "schluessel")}
          className={inputClass}
        >
          <option value="fundsache">Fundsache</option>
          <option value="schluessel">Schlüssel</option>
        </select>
      </Field>

      <Field
        label="Bezeichnung *"
        hint={kind === "schluessel" ? "z. B. Vorführwagen HB-AH 123" : "z. B. Handy, schwarz"}
      >
        <input name="title" required minLength={2} className={inputClass} />
      </Field>

      <Field label="Aufbewahrungsort" hint="z. B. Tresor Empfang">
        <input name="storagePlace" className={inputClass} />
      </Field>

      <Field label="Standort">
        <select name="locationId" defaultValue="" className={inputClass}>
          <option value="">– ohne –</option>
          {organisation.locations.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </Field>

      {kind === "fundsache" ? (
        <>
          <Field label="Fundort *" hint="Ohne ihn ist die Rückgabe Glück">
            <input name="foundPlace" required className={inputClass} placeholder="z. B. Kundenparkplatz Reihe 2" />
          </Field>
          <Field label="Gefunden am" hint="Leer lassen setzt heute">
            <input name="foundAt" type="date" className={inputClass} />
          </Field>
        </>
      ) : null}

      <Field label="Beschreibung" wide>
        <input name="description" className={inputClass} placeholder="Merkmale, Zustand, Besonderheiten" />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Eintrag aufnehmen</SubmitButton>
      </div>
    </form>
  );
}
