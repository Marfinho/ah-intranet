"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { updateTenantProfileAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function TenantProfileForm({ defaults }: { defaults: { name: string; notes: string } }) {
  const [state, formAction] = useFormState(updateTenantProfileAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Name des Hauses *">
        <input name="name" required defaultValue={defaults.name} className={inputClass} />
      </Field>
      <Field label="Hinweise" wide hint="Erscheinen intern, z. B. für die Ersteinrichtung anderer Konten">
        <textarea name="notes" rows={3} defaultValue={defaults.notes} className={inputClass} />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>
      <div className="md:col-span-2">
        <SubmitButton>Mandantenprofil speichern</SubmitButton>
      </div>
    </form>
  );
}
