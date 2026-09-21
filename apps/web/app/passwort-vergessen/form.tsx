"use client";

import { useFormState } from "react-dom";
import { passwortVergessenAction, type ActionState } from "@/lib/actions";
import { FormAlert, SubmitButton, inputClass } from "@/components/forms";

const initialState: ActionState = { ok: true };

export function PasswortVergessenForm() {
  const [state, formAction] = useFormState(passwortVergessenAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Benutzername
        <input name="username" autoComplete="username" autoFocus required className={inputClass} />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Haus-Kennung <span className="font-normal text-slate-400">(optional)</span>
        <input name="tenant" autoComplete="organization" className={inputClass} />
      </label>

      <FormAlert state={state} />

      <div className="pt-1">
        <SubmitButton>Link anfordern</SubmitButton>
      </div>
    </form>
  );
}
