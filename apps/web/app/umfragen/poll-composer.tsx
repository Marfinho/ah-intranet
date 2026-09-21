"use client";

import { useFormState } from "react-dom";
import type { ZielgruppenKatalog } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { ZielgruppenAuswahl } from "@/components/zielgruppen-auswahl";
import { createPollAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function PollComposer({ katalog }: { katalog: ZielgruppenKatalog }) {
  const [state, formAction] = useFormState(createPollAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Frage *" wide>
        <input
          name="question"
          required
          minLength={5}
          className={inputClass}
          placeholder="Worüber soll abgestimmt werden?"
        />
      </Field>

      <Field label="Erläuterung" wide>
        <input name="description" className={inputClass} placeholder="optionaler Zusatz" />
      </Field>

      <Field label="Antwortmöglichkeiten *" wide hint="Eine Option pro Zeile, mindestens zwei">
        <textarea
          name="options"
          rows={4}
          required
          className={inputClass}
          placeholder={"Freitagabend\nSamstagnachmittag"}
        />
      </Field>

      <Field label="Läuft bis">
        <input name="closesAt" type="date" className={inputClass} />
      </Field>

      <Field label="Zielgruppe" wide hint="Vorsicht bei kleinen Zielgruppen - Umfragen sind nicht anonym">
        <div className="mt-2">
          <ZielgruppenAuswahl katalog={katalog} />
        </div>
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Umfrage starten</SubmitButton>
      </div>
    </form>
  );
}
