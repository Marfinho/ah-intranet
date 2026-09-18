"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { upsertCycleAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function CycleForm() {
  const [state, formAction] = useFormState(upsertCycleAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Termin-ID" hint="Leer lassen für einen neuen Termin">
        <input name="id" className={inputClass} placeholder="nur zum Bearbeiten" />
      </Field>

      <Field label="Bestellart *">
        <select name="cycleType" required defaultValue="business_cards" className={inputClass}>
          <option value="business_cards">Visitenkarten</option>
          <option value="workwear">Arbeitskleidung</option>
        </select>
      </Field>

      <Field label="Bezeichnung *">
        <input name="title" required minLength={2} className={inputClass} placeholder="Sammelbestellung Visitenkarten" />
      </Field>

      <Field label="Stichtag *">
        <input name="nextOrderDate" type="date" required className={inputClass} />
      </Field>

      <Field label="Hinweis" wide>
        <input name="notes" className={inputClass} placeholder="z. B. Freigaben bis 3 Werktage vorher" />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Termin speichern</SubmitButton>
      </div>
    </form>
  );
}
