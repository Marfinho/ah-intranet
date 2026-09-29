"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createLocationAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function LocationComposer() {
  const [state, formAction] = useFormState(createLocationAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-3">
      <Field label="Name *" hint="z. B. Autohaus Hackerott Hamburg">
        <input name="name" required minLength={2} className={inputClass} />
      </Field>

      <Field label="Kennung *" hint="Kurz, je Mandant eindeutig - dient als Zielgruppe (location:HH)">
        <input name="code" required minLength={1} maxLength={10} className={inputClass} placeholder="z. B. HH" />
      </Field>

      <Field label="Adresse">
        <input name="address" className={inputClass} placeholder="Straße, PLZ Ort" />
      </Field>

      <div className="md:col-span-3">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-3">
        <SubmitButton>Standort anlegen</SubmitButton>
      </div>
    </form>
  );
}
