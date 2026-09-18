"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { changePasswordAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function PasswordForm() {
  const [state, formAction] = useFormState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Aktuelles Passwort *" wide>
        <input name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>

      <Field label="Neues Passwort *">
        <input name="newPassword" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      </Field>

      <Field label="Neues Passwort wiederholen *">
        <input name="repeatPassword" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Passwort ändern</SubmitButton>
      </div>
    </form>
  );
}
