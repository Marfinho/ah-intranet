"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState } from "react-dom";
import { loginAction, type ActionState } from "@/lib/actions";
import { FormAlert, SubmitButton, inputClass } from "@/components/forms";

const initialState: ActionState = { ok: true };

/** Wie in `lib/api.ts`: im Browser gibt es nur die öffentliche Variable. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(loginAction, initialState);
  const [tenant, setTenant] = useState("");

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
        <input
          name="tenant"
          autoComplete="organization"
          placeholder="z. B. autohaus-mueller"
          className={inputClass}
          value={tenant}
          onChange={(event) => setTenant(event.target.value)}
        />
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

      <div className="flex items-center gap-3 pt-2 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        oder
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <a
        href={`${API_URL}/auth/entra/login?tenant=${encodeURIComponent(tenant.trim().toLowerCase())}`}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Mit Microsoft anmelden
      </a>

      <p className="pt-2 text-sm text-slate-600">
        <Link href="/passwort-vergessen" className="font-semibold text-brand-700 hover:underline">
          Passwort vergessen?
        </Link>
      </p>
    </form>
  );
}
