"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createPollAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function PollComposer() {
  const [state, formAction] = useActionState(createPollAction, initialState);

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

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Umfrage starten</SubmitButton>
      </div>
    </form>
  );
}
