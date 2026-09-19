"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createNewsAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/** Zielgruppen als Tokens: `global` oder `<typ>:<code>`. */
const AUDIENCES = [
  { value: "global", label: "Alle Mitarbeitenden" },
  { value: "location:HB", label: "Standort Bremen" },
  { value: "location:DEL", label: "Standort Delmenhorst" },
  { value: "location:ACH", label: "Standort Achim" },
  { value: "department:SRV", label: "Service & Werkstatt" },
  { value: "department:VKN", label: "Verkauf Neuwagen" },
  { value: "department:VKG", label: "Verkauf Gebrauchtwagen" },
  { value: "department:TDI", label: "Teiledienst" },
  { value: "department:VWL", label: "Verwaltung" },
  { value: "department:MKT", label: "Marketing" },
  { value: "department:IT", label: "IT" },
  { value: "specialty:EMOB", label: "Elektromobilität" },
  { value: "specialty:NFZ", label: "Nutzfahrzeuge" },
  { value: "specialty:KUL", label: "Karosserie & Lack" },
];

export function NewsComposer() {
  const [state, formAction] = useFormState(createNewsAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Titel *" wide>
        <input name="title" required minLength={3} className={inputClass} />
      </Field>

      <Field label="Teaser *" wide hint="Kurzfassung für Übersicht und Dashboard">
        <textarea name="teaser" rows={2} required minLength={3} className={inputClass} />
      </Field>

      <Field label="Inhalt *" wide>
        <textarea name="content" rows={8} required minLength={3} className={inputClass} />
      </Field>

      <Field label="Priorität *" hint="Hoch und kritisch lösen eine Benachrichtigung aus">
        <select name="priority" required defaultValue="normal" className={inputClass}>
          <option value="niedrig">niedrig</option>
          <option value="normal">normal</option>
          <option value="hoch">hoch</option>
          <option value="kritisch">kritisch</option>
        </select>
      </Field>

      <Field label="Status *">
        <select name="status" required defaultValue="draft" className={inputClass}>
          <option value="draft">Entwurf</option>
          <option value="published">Sofort veröffentlichen</option>
        </select>
      </Field>

      <Field label="Gültig bis" hint="Optional, danach wird der Beitrag ausgeblendet">
        <input name="expiresAt" type="date" className={inputClass} />
      </Field>

      <label className="flex items-center gap-3 self-end rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
        <input type="checkbox" name="pinned" className="h-4 w-4" />
        Beitrag oben anpinnen
      </label>

      <Field label="Zielgruppen *" wide hint="Mehrfachauswahl; ohne Auswahl gilt „Alle Mitarbeitenden“">
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
        <SubmitButton>Beitrag speichern</SubmitButton>
      </div>
    </form>
  );
}
