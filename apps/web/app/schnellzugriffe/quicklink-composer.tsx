"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createQuickLinkAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function QuickLinkComposer() {
  const [state, formAction] = useActionState(createQuickLinkAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Bezeichnung *">
        <input name="label" required minLength={2} className={inputClass} placeholder="z. B. Zeiterfassung" />
      </Field>

      <Field label="Adresse *">
        <input name="url" type="url" required className={inputClass} placeholder="https://…" />
      </Field>

      <Field label="Beschreibung" wide>
        <input name="description" className={inputClass} placeholder="Wofür wird der Link gebraucht?" />
      </Field>

      <Field label="Sortierung" hint="Kleinere Zahlen erscheinen zuerst">
        <input name="sortOrder" type="number" defaultValue={0} className={inputClass} />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Schnellzugriff speichern</SubmitButton>
      </div>
    </form>
  );
}
