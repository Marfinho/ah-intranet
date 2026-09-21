"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createBrandAction, deleteBrandAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

interface Brand {
  id: string;
  name: string;
  code: string;
}

/** Marken anlegen und löschen - die Tags, die Standorte tragen können. */
export function BrandManager({ brands }: { brands: Brand[] }) {
  const [state, formAction] = useFormState(createBrandAction, initialState);
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);

  const loeschen = (brand: Brand) => {
    if (!window.confirm(`Marke "${brand.name}" wirklich löschen? Standorte verlieren die Zuordnung.`)) {
      return;
    }
    setDeleting(brand.id);
    startTransition(async () => {
      const result = await deleteBrandAction(brand.id);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
      setDeleting(null);
    });
  };

  return (
    <div className="space-y-4">
      {brands.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Marken angelegt.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {brands.map((brand) => (
            <li
              key={brand.id}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-900">{brand.name}</span>
              <span className="font-mono text-xs text-slate-400">{brand.code}</span>
              <button
                type="button"
                disabled={pending && deleting === brand.id}
                onClick={() => loeschen(brand)}
                className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-40"
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="grid gap-4 sm:grid-cols-[2fr,1fr,auto] sm:items-end">
        <Field label="Neue Marke *" hint="z. B. Volkswagen">
          <input name="name" required minLength={2} className={inputClass} />
        </Field>
        <Field label="Code *" hint="z. B. VW">
          <input name="code" required minLength={2} maxLength={10} className={inputClass} />
        </Field>
        <SubmitButton>Marke anlegen</SubmitButton>
      </form>
      <FormAlert state={state} />
    </div>
  );
}
