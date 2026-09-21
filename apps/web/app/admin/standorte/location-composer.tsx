"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createLocationAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

interface Brand {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
}

/** Neuen Standort anlegen - Marken werden angeklickt wie Tags. */
export function LocationComposer({ brands }: { brands: Brand[] }) {
  const [state, formAction] = useFormState(createLocationAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Name *" hint="z. B. Bremen-Hauptbetrieb">
        <input name="name" required minLength={2} className={inputClass} />
      </Field>

      <Field label="Code *" hint="Kurzkennung, 2–10 Zeichen, z. B. HB">
        <input name="code" required minLength={2} maxLength={10} className={inputClass} />
      </Field>

      <Field label="Adresse" wide>
        <input name="address" className={inputClass} />
      </Field>

      <Field label="Marken" wide hint="Welche Marken führt dieser Standort? Mehrfachauswahl möglich">
        {brands.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Noch keine Marken angelegt - unten anlegen.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {brands.map((brand) => (
              <label
                key={brand.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <input type="checkbox" name="brandIds" value={brand.id} className="h-4 w-4" />
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Logo liegt als freie URL vor, kein eigenes Asset.
                  <img src={brand.logoUrl} alt="" className="h-4 w-4 shrink-0 rounded-sm object-contain grayscale" />
                ) : null}
                {brand.name}
              </label>
            ))}
          </div>
        )}
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Standort anlegen</SubmitButton>
      </div>
    </form>
  );
}
