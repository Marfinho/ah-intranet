"use client";

import Link from "next/link";
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
        Haus-Kennung <span className="font-normal text-slate-400">(optional)</span>
        <input name="tenant" autoComplete="organization" placeholder="z. B. autohaus-mueller" className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Nur nötig, wenn Ihr Haus keine eigene Adresse hat.
        </span>
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Passwort
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>

      <FormAlert state={state} />

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
