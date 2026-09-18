"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createTicketAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function TicketComposer() {
  const [state, formAction] = useFormState(createTicketAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Betreff *" wide>
        <input name="title" required minLength={3} className={inputClass} placeholder="Kurz und aussagekräftig" />
      </Field>

      <Field label="Kategorie *">
        <select name="category" required defaultValue="it" className={inputClass}>
          <option value="it">IT</option>
          <option value="facility">Facility</option>
          <option value="hr">Personal</option>
          <option value="marketing">Marketing</option>
          <option value="fuhrpark">Fuhrpark</option>
        </select>
      </Field>

      <Field label="Priorität *">
        <select name="priority" required defaultValue="normal" className={inputClass}>
          <option value="niedrig">niedrig</option>
          <option value="normal">normal</option>
          <option value="hoch">hoch</option>
          <option value="kritisch">kritisch</option>
        </select>
      </Field>

      <Field label="Beschreibung *" wide hint="Was ist passiert, seit wann, welcher Arbeitsplatz oder welches Fahrzeug?">
        <textarea name="description" rows={4} required minLength={5} className={inputClass} />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Anfrage absenden</SubmitButton>
      </div>
    </form>
  );
}
