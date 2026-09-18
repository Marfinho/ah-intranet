"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { updateProfileAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function ProfileForm({ defaults }: { defaults: Record<string, string> }) {
  const [state, formAction] = useFormState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Telefon">
        <input name="phone" defaultValue={defaults.phone} className={inputClass} placeholder="0421 5550-000" />
      </Field>

      <Field label="Mobil">
        <input name="mobile" defaultValue={defaults.mobile} className={inputClass} placeholder="0171 0000000" />
      </Field>

      <Field label="Anwesenheit">
        <select name="presence" defaultValue={defaults.presence} className={inputClass}>
          <option value="vor Ort">vor Ort</option>
          <option value="mobil">mobil</option>
          <option value="abwesend">abwesend</option>
        </select>
      </Field>

      <Field label="Zuständigkeiten" hint="Kommagetrennt, erscheint im Verzeichnis">
        <input
          name="responsibilities"
          defaultValue={defaults.responsibilities}
          className={inputClass}
          placeholder="Neuwagenverkauf, Probefahrten"
        />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Profil speichern</SubmitButton>
      </div>
    </form>
  );
}
