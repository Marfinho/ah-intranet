"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createWikiAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function WikiComposer({ categories }: { categories: string[] }) {
  const [state, formAction] = useActionState(createWikiAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Titel" wide>
        <input name="title" required minLength={3} className={inputClass} placeholder="z. B. Reklamation bearbeiten" />
      </Field>

      <Field label="Kategorie">
        <input
          name="category"
          required
          list="wiki-categories"
          className={inputClass}
          placeholder="Service, IT, Verkauf …"
        />
        <datalist id="wiki-categories">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </Field>

      <Field label="Schlagwörter" hint="Kommagetrennt, erleichtern das Auffinden">
        <input name="tags" className={inputClass} placeholder="service, reklamation" />
      </Field>

      <Field label="Inhalt" wide>
        <textarea name="content" rows={8} required minLength={20} className={inputClass} />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Artikel veröffentlichen</SubmitButton>
      </div>
    </form>
  );
}
