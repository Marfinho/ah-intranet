"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import type { ActionState } from "@/lib/actions";

const start: ActionState = { ok: true };

/** Kennung und erstes Konto: das Einzige, was nicht aus dem Interessenten kommt. */
export function HausForm({
  action,
  kennung,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  kennung: string | null;
}) {
  const [state, formAction] = useFormState(action, start);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Kennung *" hint="Kleinbuchstaben, Ziffern, Bindestriche. Dient der Anmeldung.">
        <input
          name="slug"
          required
          defaultValue={kennung ?? ""}
          pattern="[a-z0-9][a-z0-9-]{1,40}"
          className={inputClass}
        />
      </Field>
      <Field label="Eigene Adresse" hint="Optional. Ist sie gesetzt, entfällt die Kennung bei der Anmeldung.">
        <input name="domain" className={inputClass} placeholder="intranet.beispiel.de" />
      </Field>

      <div className="md:col-span-2 mt-2 border-t border-slate-200 pt-4">
        <p className="text-sm font-semibold text-slate-900">Erstes Administrationskonto</p>
        <p className="mt-1 text-sm text-slate-600">
          Das Startpasswort muss beim ersten Anmelden geändert werden. Geben Sie es auf einem anderen Weg weiter als die
          Kennung.
        </p>
      </div>

      <Field label="Benutzername *">
        <input name="adminUsername" required className={inputClass} placeholder="admin" />
      </Field>
      <Field label="Startpasswort *" hint="Mindestens 10 Zeichen">
        <input name="adminPassword" type="password" required minLength={10} className={inputClass} />
      </Field>
      <Field label="Vorname">
        <input name="adminFirstName" className={inputClass} />
      </Field>
      <Field label="Nachname">
        <input name="adminLastName" className={inputClass} />
      </Field>
      <Field label="E-Mail" wide>
        <input name="adminEmail" type="email" className={inputClass} />
      </Field>

      <div className="md:col-span-2 space-y-3">
        <FormAlert state={state} />
        <SubmitButton>Haus anlegen</SubmitButton>
      </div>
    </form>
  );
}
