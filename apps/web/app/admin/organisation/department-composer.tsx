"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createDepartmentAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/** Anlage einer Abteilung - ohne Lizenzgrenze, das Haus organisiert sich selbst. */
export function DepartmentComposer() {
  const [state, formAction] = useFormState(createDepartmentAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Name *">
        <input name="name" required minLength={2} className={inputClass} placeholder="Service" />
      </Field>
      <Field label="Kürzel *">
        <input name="code" required minLength={2} className={inputClass} placeholder="SRV" />
      </Field>
      <div className="md:col-span-2">
        <FormAlert state={state} />
        <div className="pt-2">
          <SubmitButton>Abteilung anlegen</SubmitButton>
        </div>
      </div>
    </form>
  );
}
