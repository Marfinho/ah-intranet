"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { upsertFieldDefinitionAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function FieldDefinitionForm({ nextSortOrder }: { nextSortOrder: number }) {
  const [state, formAction] = useFormState(upsertFieldDefinitionAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Feld-ID" hint="Leer lassen für ein neues Feld">
        <input name="id" className={inputClass} placeholder="nur zum Bearbeiten" />
      </Field>

      <Field label="Schlüssel *" hint="Technischer Name, z. B. fullName">
        <input name="key" required className={inputClass} placeholder="fullName" />
      </Field>

      <Field label="Beschriftung *">
        <input name="label" required className={inputClass} placeholder="Name" />
      </Field>

      <Field label="Typ *">
        <select name="fieldType" required defaultValue="text" className={inputClass}>
          <option value="text">Text</option>
          <option value="email">E-Mail</option>
          <option value="phone">Telefon</option>
          <option value="select">Auswahlliste</option>
          <option value="checkbox">Ankreuzfeld</option>
        </select>
      </Field>

      <Field label="Reihenfolge *">
        <input name="sortOrder" type="number" required defaultValue={nextSortOrder} className={inputClass} />
      </Field>

      <Field label="Optionen" hint="Nur bei Auswahlliste, kommagetrennt">
        <input name="options" className={inputClass} placeholder="Bremen, Delmenhorst, Achim" />
      </Field>

      <Field label="Hilfetext" wide>
        <input name="helpText" className={inputClass} />
      </Field>

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
        <input type="checkbox" name="isRequired" className="h-5 w-5" />
        Pflichtfeld
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
        <input type="checkbox" name="isActive" defaultChecked className="h-5 w-5" />
        Im Formular anzeigen
      </label>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Feld speichern</SubmitButton>
      </div>
    </form>
  );
}
