"use client";

import { useFormState } from "react-dom";
import type { RoleSummary } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createUserAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function UserComposer({
  organisation,
  roles,
}: {
  organisation: {
    locations: { id: string; name: string }[];
    departments: { id: string; name: string }[];
    specialties: { id: string; name: string }[];
  };
  /** Rollen dieses Hauses - der Code kennt sie nicht, er zeigt sie nur an. */
  roles: RoleSummary[];
}) {
  const [state, formAction] = useFormState(createUserAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Benutzername *" hint="Wird kleingeschrieben gespeichert">
        <input name="username" required minLength={3} className={inputClass} placeholder="v.nachname" />
      </Field>

      <Field label="E-Mail">
        <input name="email" type="email" className={inputClass} placeholder="name@autohaus-beispiel.de" />
      </Field>

      <Field label="Vorname *">
        <input name="firstName" required minLength={2} className={inputClass} />
      </Field>

      <Field label="Nachname *">
        <input name="lastName" required minLength={2} className={inputClass} />
      </Field>

      <Field label="Funktion">
        <input name="jobTitle" className={inputClass} placeholder="z. B. Serviceberater:in" />
      </Field>

      <Field label="Telefon">
        <input name="phone" className={inputClass} />
      </Field>

      <Field label="Standort">
        <select name="locationId" defaultValue="" className={inputClass}>
          <option value="">– ohne –</option>
          {organisation.locations.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Abteilung">
        <select name="departmentId" defaultValue="" className={inputClass}>
          <option value="">– ohne –</option>
          {organisation.departments.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Fachbereich">
        <select name="specialtyAreaId" defaultValue="" className={inputClass}>
          <option value="">– ohne –</option>
          {organisation.specialties.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Rollen *" hint="Mehrfachauswahl möglich" wide>
        <div className="mt-2 flex flex-wrap gap-3">
          {roles.map((role) => (
            <label
              key={role.key}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="roles"
                value={role.key}
                defaultChecked={role.key === "mitarbeiter"}
                className="h-5 w-5"
              />
              {role.name}
            </label>
          ))}
        </div>
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Konto anlegen</SubmitButton>
      </div>
    </form>
  );
}
