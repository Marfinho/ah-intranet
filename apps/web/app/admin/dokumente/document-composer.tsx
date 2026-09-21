"use client";

import { useFormState } from "react-dom";
import type { ZielgruppenKatalog } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { ZielgruppenAuswahl } from "@/components/zielgruppen-auswahl";
import { createDocumentAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function DocumentComposer({ categories, katalog }: { categories: string[]; katalog: ZielgruppenKatalog }) {
  const [state, formAction] = useFormState(createDocumentAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Titel *">
        <input name="title" required minLength={2} className={inputClass} />
      </Field>

      <Field label="Kategorie *">
        <input
          name="category"
          required
          list="doc-categories"
          className={inputClass}
          placeholder="Formulare, Prozesse …"
        />
        <datalist id="doc-categories">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </Field>

      <Field label="Dateityp *">
        <select name="fileType" required defaultValue="pdf" className={inputClass}>
          <option value="pdf">PDF</option>
          <option value="docx">Word</option>
          <option value="xlsx">Excel</option>
          <option value="link">Link</option>
        </select>
      </Field>

      <Field label="Adresse *" hint="Pfad im DMS oder vollständige URL">
        <input name="url" required className={inputClass} placeholder="/dokumente/datei.pdf" />
      </Field>

      <Field label="Beschreibung" wide>
        <input name="description" className={inputClass} />
      </Field>

      <Field label="Zielgruppe" wide hint="Von allen Häusern der Gruppe bis hinunter zur Abteilung">
        <div className="mt-2">
          <ZielgruppenAuswahl katalog={katalog} />
        </div>
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Dokument speichern</SubmitButton>
      </div>
    </form>
  );
}
