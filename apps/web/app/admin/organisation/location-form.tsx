"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createLocationAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function LocationForm() {
  const [state, formAction] = useFormState(createLocationAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-3">
      <Field label="Name *">
        <input name="name" required className={inputClass} placeholder="Autohaus Bremen" />
      </Field>
      <Field label="Kürzel *" hint="Kurze Kennung, z. B. HB">
        <input name="code" required className={inputClass} placeholder="HB" />
      </Field>
      <Field label="Adresse">
        <input name="address" className={inputClass} placeholder="Beispielstraße 1, 28195 Bremen" />
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
