"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createLocationAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/** Anlage eines Autohauses (Standort) - nur innerhalb der Lizenzgrenze. */
export function LocationComposer() {
  const [state, formAction] = useFormState(createLocationAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Name *">
        <input name="name" required minLength={2} className={inputClass} placeholder="Autohaus Musterstadt" />
      </Field>
      <Field label="Kürzel *" hint="Kurz, eindeutig - z. B. für Zielgruppen und Dienstpläne">
        <input name="code" required minLength={2} className={inputClass} placeholder="MS" />
      </Field>
      <Field label="Adresse" wide>
        <input name="address" className={inputClass} placeholder="Straße, PLZ, Ort" />
      </Field>
      <div className="md:col-span-2">
        <FormAlert state={state} />
        <div className="pt-2">
          <SubmitButton>Standort anlegen</SubmitButton>
        </div>
      </div>
    </form>
  );
}
