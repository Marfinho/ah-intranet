"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createIdeaAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function IdeaComposer() {
  const [state, formAction] = useFormState(createIdeaAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Titel *">
        <input name="title" required minLength={5} className={inputClass} placeholder="Worum geht es?" />
      </Field>

      <Field label="Bereich">
        <select name="category" defaultValue="Allgemein" className={inputClass}>
          <option>Allgemein</option>
          <option>Prozesse</option>
          <option>Arbeitsumfeld</option>
          <option>Kundenservice</option>
          <option>Nachhaltigkeit</option>
          <option>IT</option>
        </select>
      </Field>

      <Field label="Beschreibung *" wide hint="Was ist das Problem, was schlagen Sie vor, was bringt es?">
        <textarea name="description" rows={4} required minLength={10} className={inputClass} />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Idee einreichen</SubmitButton>
      </div>
    </form>
  );
}
