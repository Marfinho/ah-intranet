"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { loginAction, loginMfaAction, type ActionState } from "@/lib/actions";
import { FormAlert, SubmitButton, inputClass } from "@/components/forms";

const initialState: ActionState = { ok: true };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(loginAction, initialState);
  const [mfaState, mfaAction] = useFormState(loginMfaAction, initialState);

  // Zweiter Schritt: das Passwort war richtig, jetzt fehlt der Code. Das
  // Zwischentoken kommt aus dem ersten Schritt, bei einem Fehlversuch aus dem zweiten.
  const mfaToken = mfaState.mfaToken ?? (mfaState.message ? undefined : state.mfaToken);
  if (mfaToken) {
    return (
      <form action={mfaAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="mfaToken" value={mfaToken} />

        <p className="text-sm text-slate-600">
          Bitte den sechsstelligen Code Ihrer Authenticator-App eingeben. Ohne Telefon geht auch einer Ihrer
          Wiederherstellungscodes.
        </p>

        <label className="block text-sm font-medium text-slate-700">
          Code
          <input
            name="code"
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={20}
            placeholder="123 456"
            className={inputClass}
          />
        </label>

        <FormAlert state={mfaState} />

        <div className="pt-1">
          <SubmitButton>Bestätigen</SubmitButton>
        </div>
      </form>
    );
  }

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

      <FormAlert state={mfaState.message && !mfaState.mfaToken ? mfaState : state} />

      <div className="pt-1">
        <SubmitButton>Anmelden</SubmitButton>
      </div>

      <p className="pt-2 text-sm text-slate-600">
        <Link href="/passwort-vergessen" className="font-semibold text-brand-700 hover:underline">
          Passwort vergessen?
        </Link>
      </p>
    </form>
  );
}
