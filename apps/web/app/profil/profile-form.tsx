"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { updateProfileAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function ProfileForm({
  defaults,
  mobileInDirectory,
}: {
  defaults: Record<string, string>;
  mobileInDirectory: boolean;
}) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Telefon">
        <input name="phone" defaultValue={defaults.phone} className={inputClass} placeholder="0421 5550-000" />
      </Field>

      <Field label="Mobil">
        <input name="mobile" defaultValue={defaults.mobile} className={inputClass} placeholder="0171 0000000" />
        {/*
          Die Mobilnummer ist oft eine private. Das Verzeichnis steht jedem
          angemeldeten Konto offen - wer die Nummer dort nicht haben möchte,
          soll sie nicht löschen müssen, um sie der Verwaltung vorzuenthalten.
        */}
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="mobileInDirectory"
            defaultChecked={mobileInDirectory}
            className="h-4 w-4 rounded border-slate-300"
          />
          Im Mitarbeiterverzeichnis anzeigen
        </label>
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
