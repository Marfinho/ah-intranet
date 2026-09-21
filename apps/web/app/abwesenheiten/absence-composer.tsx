"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createAbsenceAction, type ActionState } from "@/lib/actions";
import { toDateInput } from "@/lib/utils";

const initialState: ActionState = { ok: true };

export function AbsenceComposer() {
  const [state, formAction] = useActionState(createAbsenceAction, initialState);
  const today = toDateInput(new Date());

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Art *">
        <select name="type" required defaultValue="urlaub" className={inputClass}>
          <option value="urlaub">Urlaub</option>
          <option value="krank">Krankmeldung</option>
          <option value="gleitzeit">Gleitzeit</option>
          <option value="sonderurlaub">Sonderurlaub</option>
          <option value="fortbildung">Fortbildung</option>
        </select>
      </Field>

      <Field label="Von *">
        <input name="startDate" type="date" required min={undefined} defaultValue={today} className={inputClass} />
      </Field>

      <Field label="Bis *">
        <input name="endDate" type="date" required defaultValue={today} className={inputClass} />
      </Field>

      <Field label="Anmerkung" hint="z. B. Vertretungsregelung">
        <input name="note" className={inputClass} placeholder="optional" />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Antrag einreichen</SubmitButton>
      </div>
    </form>
  );
}
