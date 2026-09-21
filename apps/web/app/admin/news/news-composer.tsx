"use client";

import { useFormState } from "react-dom";
import type { ZielgruppenKatalog } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { ZielgruppenAuswahl } from "@/components/zielgruppen-auswahl";
import { createNewsAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function NewsComposer({ katalog }: { katalog: ZielgruppenKatalog }) {
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
        <input type="checkbox" name="pinned" className="h-5 w-5" />
        Beitrag oben anpinnen
      </label>

      <Field label="Zielgruppe" wide hint="Von allen Häusern der Gruppe bis hinunter zur Abteilung">
        <div className="mt-2">
          <ZielgruppenAuswahl katalog={katalog} />
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
