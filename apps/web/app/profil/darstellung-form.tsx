"use client";

import { useFormState } from "react-dom";
import { DARSTELLUNG_DEFINITIONS, type Darstellung } from "@ah-intranet/shared";
import { FormAlert, SubmitButton } from "@/components/forms";
import { updateDarstellungAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function DarstellungForm({ current }: { current: Darstellung }) {
  const [state, formAction] = useFormState(updateDarstellungAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="sr-only">Darstellung wählen</legend>
        {DARSTELLUNG_DEFINITIONS.map((eintrag) => (
          <label
            key={eintrag.key}
            className="flex cursor-pointer gap-3 rounded-2xl border border-slate-300 bg-white p-4 hover:border-brand-600 has-[:checked]:border-brand-600 has-[:checked]:ring-2 has-[:checked]:ring-brand-600"
          >
            <input
              type="radio"
              name="darstellung"
              value={eintrag.key}
              defaultChecked={eintrag.key === current}
              className="mt-1 h-5 w-5 accent-brand-600"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">{eintrag.name}</span>
              <span className="mt-1 block text-xs text-slate-600">{eintrag.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <FormAlert state={state} />

      <div>
        <SubmitButton>Darstellung übernehmen</SubmitButton>
      </div>
    </form>
  );
}
