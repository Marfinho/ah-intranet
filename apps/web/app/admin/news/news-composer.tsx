"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createNewsAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

interface OrganisationEintrag {
  code: string;
  name: string;
}

export interface NewsComposerOrganisation {
  locations: OrganisationEintrag[];
  departments: OrganisationEintrag[];
  specialties: OrganisationEintrag[];
  brands: OrganisationEintrag[];
}

/**
 * Zielgruppen als Tokens: `global` oder `<typ>:<code>`. Kommt aus den
 * tatsächlichen Stammdaten des Hauses statt aus einer festen Liste - sonst
 * stimmten die Codes für jedes Haus mit anderen Standorten nicht.
 */
function buildAudiences(organisation: NewsComposerOrganisation) {
  return [
    { value: "global", label: "Alle Mitarbeitenden" },
    ...organisation.locations.map((entry) => ({ value: `location:${entry.code}`, label: `Standort ${entry.name}` })),
    ...organisation.departments.map((entry) => ({ value: `department:${entry.code}`, label: entry.name })),
    ...organisation.specialties.map((entry) => ({ value: `specialty:${entry.code}`, label: entry.name })),
    ...organisation.brands.map((entry) => ({ value: `brand:${entry.code}`, label: `Marke ${entry.name}` })),
  ];
}

export function NewsComposer({ organisation }: { organisation: NewsComposerOrganisation }) {
  const [state, formAction] = useFormState(createNewsAction, initialState);
  const AUDIENCES = buildAudiences(organisation);

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
