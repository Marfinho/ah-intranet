"use client";

import { useFormState } from "react-dom";
import { useTransition } from "react";
import type { AuthProviderDefinition, AuthProviderSummary } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import {
  removeAuthProviderAction,
  saveAuthProviderAction,
  setAuthProviderActiveAction,
  type ActionState,
} from "@/lib/actions";

const initialState: ActionState = { ok: true };

/**
 * Zugangsdaten einer zusätzlichen Anmeldeart.
 *
 * Der Clientschlüssel wird nie zurückgelesen – das Feld bleibt leer, auch wenn
 * einer hinterlegt ist. Leer lassen heißt: den gespeicherten behalten.
 */
export function AuthProviderForm({
  art,
  eintrag,
}: {
  art: AuthProviderDefinition;
  eintrag: AuthProviderSummary | null;
}) {
  const [state, formAction] = useFormState(saveAuthProviderAction, initialState);
  const [pending, startTransition] = useTransition();

  const melde = (result: ActionState) => {
    if (!result.ok && result.message) {
      window.alert(result.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={eintrag?.isActive ? "badge bg-emerald-100 text-emerald-800" : "badge bg-slate-100 text-slate-600"}
        >
          {eintrag?.isActive ? "Im Anmeldeformular sichtbar" : "Nicht freigeschaltet"}
        </span>
        {eintrag ? (
          <span className="badge bg-slate-100 text-slate-600">
            {eintrag.hasSecret ? "Clientschlüssel hinterlegt" : "Clientschlüssel fehlt"}
          </span>
        ) : null}
        {!art.inBetrieb ? (
          <span className="badge bg-amber-100 text-amber-900">Vorbereitet, nicht in Betrieb</span>
        ) : null}
      </div>

      {!art.inBetrieb ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Der Austausch mit {art.name} ist in dieser Fassung nicht gebaut. Die Zugangsdaten können Sie schon hinterlegen
          – freischalten lässt sich die Anmeldeart erst danach. Ein Knopf, der ins Leere führt, wäre schlimmer als
          keiner.
        </p>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-5">
        <p className="text-sm font-semibold text-slate-900">Was Ihr Haus dafür bereitstellen muss</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {art.voraussetzungen.map((punkt) => (
            <li key={punkt}>{punkt}</li>
          ))}
        </ul>
      </div>

      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="kind" value={art.kind} />

        <Field label="Beschriftung im Anmeldeformular *">
          <input
            name="label"
            required
            minLength={2}
            defaultValue={eintrag?.label ?? "Anmeldung mit dem Firmenkonto"}
            className={inputClass}
          />
        </Field>

        <Field label="Verzeichnis-ID *" hint="Aus dem Entra-Portal, Format wie eine GUID">
          <input
            name="directory"
            required
            minLength={2}
            defaultValue={eintrag?.directory ?? ""}
            className={inputClass}
          />
        </Field>

        <Field label="Client-ID *" hint="Der App-Registrierung dieser Installation">
          <input name="clientId" required minLength={2} defaultValue={eintrag?.clientId ?? ""} className={inputClass} />
        </Field>

        <Field
          label="Clientschlüssel"
          hint={eintrag?.hasSecret ? "Leer lassen behält den hinterlegten Schlüssel" : "Wird verschlüsselt gespeichert"}
        >
          <input name="clientSecret" type="password" autoComplete="off" className={inputClass} />
        </Field>

        <div className="md:col-span-2">
          <FormAlert state={state} />
        </div>

        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <SubmitButton>Zugangsdaten speichern</SubmitButton>

          {eintrag ? (
            <>
              <button
                type="button"
                disabled={pending || (!eintrag.isActive && !art.inBetrieb)}
                onClick={() =>
                  startTransition(async () => melde(await setAuthProviderActiveAction(art.kind, !eintrag.isActive)))
                }
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                {eintrag.isActive ? "Abschalten" : "Freischalten"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Zugangsdaten für ${art.name} wirklich entfernen?`)) {
                    startTransition(async () => melde(await removeAuthProviderAction(art.kind)));
                  }
                }}
                className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-40"
              >
                Zugangsdaten entfernen
              </button>
            </>
          ) : null}
        </div>
      </form>
    </div>
  );
}
