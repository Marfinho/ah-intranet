"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import type { RoleSummary } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createUserAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function UserComposer({
  organisation,
  roles,
  people,
}: {
  organisation: {
    locations: { id: string; name: string }[];
    departments: { id: string; name: string }[];
    specialties: { id: string; name: string }[];
  };
  /** Rollen dieses Hauses - der Code kennt sie nicht, er zeigt sie nur an. */
  roles: RoleSummary[];
  /** Mögliche Vorgesetzte - alle aktiven Personen des Hauses. */
  people: { id: string; displayName: string }[];
}) {
  const [state, formAction] = useFormState(createUserAction, initialState);
  const [mitZugang, setMitZugang] = useState(true);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm md:col-span-2">
        <input
          type="checkbox"
          name="zugang"
          checked={mitZugang}
          onChange={(event) => setMitZugang(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="font-medium text-slate-800">Mit Zugang zum Intranet</span>
          <span className="block text-xs text-slate-500">
            Ohne Zugang steht die Person im Personalstamm, Organigramm und Schichtplan, kann sich aber nicht anmelden
            (z. B. Werkstatt ohne Rechner). Das Lizenzkontingent zählt sie nicht mit.
          </span>
        </span>
      </label>

      {mitZugang ? (
        <Field label="Benutzername *" hint="Wird kleingeschrieben gespeichert">
          <input name="username" required minLength={3} className={inputClass} placeholder="v.nachname" />
        </Field>
      ) : null}

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

      <Field label="Vorgesetzte Person" hint="Bestimmt das Organigramm und wer Abwesenheiten freigibt">
        <select name="managerId" defaultValue="" className={inputClass}>
          <option value="">– ohne –</option>
          {people.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.displayName}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={mitZugang ? "Rollen *" : "Rollen"}
        hint={
          mitZugang
            ? "Mehrfachauswahl möglich"
            : "Ohne Zugang ohne Wirkung - gilt, falls später ein Zugang eingerichtet wird"
        }
        wide
      >
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
                className="h-4 w-4"
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
        <SubmitButton>{mitZugang ? "Konto anlegen" : "Person anlegen"}</SubmitButton>
      </div>
    </form>
  );
}
