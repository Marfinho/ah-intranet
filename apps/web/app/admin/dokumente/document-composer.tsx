"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createDocumentAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

const AUDIENCES = [
  { value: "global", label: "Alle Mitarbeitenden" },
  { value: "location:HB", label: "Standort Bremen" },
  { value: "location:DEL", label: "Standort Delmenhorst" },
  { value: "location:ACH", label: "Standort Achim" },
  { value: "department:SRV", label: "Service & Werkstatt" },
  { value: "department:TDI", label: "Teiledienst" },
  { value: "department:VKN", label: "Verkauf Neuwagen" },
  { value: "department:VKG", label: "Verkauf Gebrauchtwagen" },
  { value: "department:VWL", label: "Verwaltung" },
];

export function DocumentComposer({ categories }: { categories: string[] }) {
  const [state, formAction] = useActionState(createDocumentAction, initialState);

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

      <Field label="Zielgruppen" wide hint="Ohne Auswahl für alle sichtbar">
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIENCES.map((audience) => (
            <label
              key={audience.value}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="audienceScopes"
                value={audience.value}
                defaultChecked={audience.value === "global"}
                className="h-4 w-4"
              />
              {audience.label}
            </label>
          ))}
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
