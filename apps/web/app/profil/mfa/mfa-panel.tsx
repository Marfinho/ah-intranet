"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { FormAlert, SubmitButton, inputClass } from "@/components/forms";
import {
  mfaBestaetigenAction,
  mfaDeaktivierenAction,
  mfaEinrichtenAction,
  mfaNeueCodesAction,
  type ActionState,
} from "@/lib/actions";

const initialState: ActionState = { ok: true };

/** Die Codes erscheinen genau einmal - deshalb mit Hinweis und Druckmöglichkeit. */
function Wiederherstellungscodes({ codes }: { codes: string[] }) {
  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-sm font-semibold text-amber-900">Wiederherstellungscodes – jetzt sichern</p>
      <p className="text-sm text-amber-900">
        Jeder Code gilt einmal und ersetzt die App, falls Ihr Telefon verloren geht. Bewahren Sie sie getrennt vom
        Telefon auf, etwa in einem Passwortmanager. Danach lassen sie sich nicht mehr anzeigen.
      </p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
        {codes.map((code) => (
          <li key={code} className="rounded-lg bg-white px-3 py-2 text-center text-slate-900">
            {code}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MfaPanel({ aktiv, pflicht }: { aktiv: boolean; pflicht: boolean }) {
  const [einrichtung, setEinrichtung] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [bestaetigung, bestaetigen] = useFormState(mfaBestaetigenAction, initialState);
  const [neueCodes, neueCodesAction] = useFormState(mfaNeueCodesAction, initialState);
  const [deaktivierung, deaktivieren] = useFormState(mfaDeaktivierenAction, initialState);

  // Direkt nach dem Bestätigen sind die Codes zu sehen, bevor irgendetwas anderes passiert.
  if (bestaetigung.wiederherstellungscodes) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Der zweite Faktor ist eingerichtet. Ab der nächsten Anmeldung wird der Code abgefragt.
        </p>
        <Wiederherstellungscodes codes={bestaetigung.wiederherstellungscodes} />
        <Link
          href="/"
          className="inline-block rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Codes gesichert – weiter
        </Link>
      </div>
    );
  }

  if (aktiv) {
    return (
      <div className="space-y-8">
        <p className="text-sm text-slate-600">
          Die Anmeldung fragt nach dem Passwort zusätzlich einen Code Ihrer Authenticator-App ab.
        </p>

        <form action={neueCodesAction} className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Neue Wiederherstellungscodes</p>
          <p className="text-sm text-slate-600">Die bisherigen verlieren damit ihre Gültigkeit.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <input name="password" type="password" required placeholder="Passwort" className={inputClass} />
            <input
              name="code"
              required
              placeholder="Code der App"
              autoComplete="one-time-code"
              className={inputClass}
            />
          </div>
          <FormAlert state={neueCodes} />
          {neueCodes.wiederherstellungscodes ? (
            <Wiederherstellungscodes codes={neueCodes.wiederherstellungscodes} />
          ) : null}
          <SubmitButton variant="ghost">Neue Codes erzeugen</SubmitButton>
        </form>

        {pflicht ? (
          <p className="text-sm text-slate-500">
            In diesem Haus ist der zweite Faktor vorgeschrieben und lässt sich nicht abschalten.
          </p>
        ) : (
          <form action={deaktivieren} className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">Zweiten Faktor abschalten</p>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="password" type="password" required placeholder="Passwort" className={inputClass} />
              <input
                name="code"
                required
                placeholder="Code der App"
                autoComplete="one-time-code"
                className={inputClass}
              />
            </div>
            <FormAlert state={deaktivierung} />
            <SubmitButton variant="ghost">Abschalten</SubmitButton>
          </form>
        )}
      </div>
    );
  }

  if (!einrichtung?.mfaQr) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Sie brauchen dafür eine Authenticator-App auf dem Telefon. Nach dem Start scannen Sie einen QR-Code und
          bestätigen mit dem ersten Code.
        </p>
        {einrichtung && !einrichtung.ok ? <FormAlert state={einrichtung} /> : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setEinrichtung(await mfaEinrichtenAction()))}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          Einrichtung starten
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Authenticator-App öffnen und ein neues Konto hinzufügen.</li>
        <li>Den QR-Code scannen – oder den Schlüssel darunter von Hand eingeben.</li>
        <li>Den angezeigten sechsstelligen Code unten eintragen.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-6">
        <img src={einrichtung.mfaQr} alt="QR-Code für die Authenticator-App" width={220} height={220} />
        <div className="text-sm">
          <p className="text-slate-500">Schlüssel zum Abtippen</p>
          <p className="mt-1 break-all font-mono text-slate-900">{einrichtung.mfaGeheimnis}</p>
        </div>
      </div>
      <form action={bestaetigen} className="max-w-xs space-y-3">
        <input
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={7}
          placeholder="123 456"
          className={inputClass}
        />
        <FormAlert state={bestaetigung} />
        <SubmitButton>Bestätigen</SubmitButton>
      </form>
    </div>
  );
}
