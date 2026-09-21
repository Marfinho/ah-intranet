"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createShiftAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function ShiftComposer({
  organisation,
  people,
}: {
  organisation: { locations: { id: string; name: string }[]; departments: { id: string; name: string }[] };
  people: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(createShiftAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Bezeichnung *" hint="z. B. Frühdienst Serviceannahme">
        <input name="label" required minLength={2} className={inputClass} />
      </Field>

      <Field label="Einteilung" hint="Leer lassen heißt: die Schicht bleibt offen">
        <select name="assigneeId" defaultValue="" className={inputClass}>
          <option value="">– offen –</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Beginn *">
        <input name="startsAt" type="datetime-local" required className={inputClass} />
      </Field>

      <Field label="Ende *">
        <input name="endsAt" type="datetime-local" required className={inputClass} />
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

      <Field label="Hinweis" wide>
        <input name="note" className={inputClass} placeholder="z. B. Schlüsseldienst, Annahme ab 7 Uhr" />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Schicht anlegen</SubmitButton>
      </div>
    </form>
  );
}
