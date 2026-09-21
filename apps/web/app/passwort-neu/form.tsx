"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { passwortNeuAction, type ActionState } from "@/lib/actions";
import { FormAlert, SubmitButton, inputClass } from "@/components/forms";

const initialState: ActionState = { ok: true };

export function PasswortNeuForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(passwortNeuAction, initialState);

  // Nach dem Setzen kein Formular mehr anbieten: der Token ist verbraucht, ein
  // zweiter Versuch würde nur eine Fehlermeldung erzeugen.
  if (state.ok && state.detail) {
    return (
      <div className="space-y-4">
        <FormAlert state={state} />
        <Link
          href="/login"
          className="inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <label className="block text-sm font-medium text-slate-700">
        Neues Passwort
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          minLength={10}
          className={inputClass}
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Wiederholen
        <input
          name="passwordRepeat"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={inputClass}
        />
      </label>

      <FormAlert state={state} />

      <div className="pt-1">
        <SubmitButton>Passwort setzen</SubmitButton>
      </div>
    </form>
  );
}
