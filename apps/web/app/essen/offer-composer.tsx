"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createMealOfferAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function MealOfferComposer({ organisation }: { organisation: { locations: { id: string; name: string }[] } }) {
  const [state, formAction] = useFormState(createMealOfferAction, initialState);
  // Drei Zeilen reichen für den Alltag; mehr fügt das Haus selbst hinzu.
  const [zeilen, setZeilen] = useState(3);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Tag *">
        <input name="date" type="date" required className={inputClass} />
      </Field>

      <Field label="Anbieter *" hint="Wer liefert oder wo abgeholt wird">
        <input name="provider" required minLength={2} className={inputClass} placeholder="z. B. Bäckerei Ahrens" />
      </Field>

      <Field label="Bestellschluss *" hint="Danach nimmt die Sammelliste nichts mehr an">
        <input name="orderDeadline" type="datetime-local" required className={inputClass} />
      </Field>

      <Field label="Standort">
        <select name="locationId" defaultValue="" className={inputClass}>
          <option value="">– alle –</option>
          {organisation.locations.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Hinweis" wide>
        <input name="note" className={inputClass} placeholder="z. B. Abholung 11:45 Uhr durch den Teiledienst" />
      </Field>

      <Field label="Wahlmöglichkeiten *" wide hint="Name und Preis in Euro">
        <div className="mt-2 space-y-2">
          {Array.from({ length: zeilen }, (_, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[3fr,1fr]">
              <input name="optionName" className={inputClass} placeholder="z. B. Belegtes Brötchen Käse" />
              <input
                name="optionPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue=""
                className={inputClass}
                placeholder="2,80"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setZeilen((wert) => wert + 1)}
            className="text-sm font-semibold text-slate-600 hover:underline"
          >
            Weitere Zeile
          </button>
        </div>
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Angebot eintragen</SubmitButton>
      </div>
    </form>
  );
}
