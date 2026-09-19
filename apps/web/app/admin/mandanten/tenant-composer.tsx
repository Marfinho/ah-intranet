"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createTenantAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/**
 * Anlage eines Autohauses samt erstem Zugang.
 *
 * Beides gehört in einen Schritt: ein Haus ohne Administrationskonto könnte
 * niemand in Betrieb nehmen, und ein nachgelagerter zweiter Schritt bliebe
 * erfahrungsgemäß liegen.
 */
export function TenantComposer() {
  const [state, formAction] = useFormState(createTenantAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Name des Hauses *">
        <input name="name" required minLength={2} className={inputClass} placeholder="Autohaus Beispiel GmbH" />
      </Field>

      <Field label="Kennung *" hint="Kleinbuchstaben, Ziffern, Bindestriche – dient der Anmeldung">
        <input
          name="slug"
          required
          pattern="[a-z0-9][a-z0-9-]{1,40}"
          className={inputClass}
          placeholder="autohaus-beispiel"
        />
      </Field>

      <Field label="Eigene Adresse" hint="Optional. Ist sie gesetzt, entfällt die Kennung bei der Anmeldung.">
        <input name="domain" className={inputClass} placeholder="intranet.autohaus-beispiel.de" />
      </Field>

      <Field label="Notiz">
        <input name="notes" className={inputClass} placeholder="Vertrag, Ansprechpartner …" />
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

      <div className="md:col-span-2">
        <FormAlert state={state} />
        <div className="pt-2">
          <SubmitButton>Haus einrichten</SubmitButton>
        </div>
      </div>
    </form>
  );
}
