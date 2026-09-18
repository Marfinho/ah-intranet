"use client";

import { useFormState } from "react-dom";
import { loginAction, type ActionState } from "@/lib/actions";
import { FormAlert, SubmitButton, inputClass } from "@/components/forms";

const initialState: ActionState = { ok: true };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <label className="block text-sm font-medium text-slate-700">
        Benutzername
        <input
          name="username"
          autoComplete="username"
          autoFocus
          required
          placeholder="z. B. p.hansen"
          className={inputClass}
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Passwort
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>

      <FormAlert state={state} />

      <div className="pt-1">
        <SubmitButton>Anmelden</SubmitButton>
      </div>
    </form>
  );
}
