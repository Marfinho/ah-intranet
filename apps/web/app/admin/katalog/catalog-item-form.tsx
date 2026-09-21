"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { upsertCatalogItemAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function CatalogItemForm() {
  const [state, formAction] = useActionState(upsertCatalogItemAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Artikel-ID" hint="Leer lassen für einen neuen Artikel">
        <input name="id" className={inputClass} placeholder="nur zum Bearbeiten" />
      </Field>

      <Field label="Bezeichnung *">
        <input name="name" required minLength={2} className={inputClass} placeholder="z. B. Poloshirt Service" />
      </Field>

      <Field label="Kategorie *">
        <input name="category" required minLength={2} className={inputClass} placeholder="Oberteile, Hosen, Schuhe" />
      </Field>

      <Field label="Beschreibung">
        <input name="description" className={inputClass} />
      </Field>

      <Field label="Größen *" wide hint="Kommagetrennt, Reihenfolge wird übernommen">
        <input name="sizes" required className={inputClass} placeholder="S, M, L, XL, XXL" />
      </Field>

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 md:col-span-2">
        <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
        Artikel ist bestellbar
      </label>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Artikel speichern</SubmitButton>
      </div>
    </form>
  );
}
