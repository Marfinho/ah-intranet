"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createBrandAction, deleteBrandAction, updateBrandLogoAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

interface Brand {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
}

/** Kleines, schwarz-weißes Vorschaubild - so, wie das Logo auch am Standort erscheint. */
function BrandLogo({ brand }: { brand: Brand }) {
  if (!brand.logoUrl) {
    return null;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Logo liegt als freie URL vor, kein eigenes Asset.
    <img
      src={brand.logoUrl}
      alt={`Logo ${brand.name}`}
      title={brand.name}
      className="h-5 w-5 shrink-0 rounded object-contain grayscale"
    />
  );
}

/** Eine Marke mit ihrem Logo-Verweis - editierbar, ohne den restlichen Datensatz anzufassen. */
function BrandLogoField({ brand }: { brand: Brand }) {
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl ?? "");
  const [pending, startTransition] = useTransition();
  const geaendert = logoUrl.trim() !== (brand.logoUrl ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={logoUrl}
        onChange={(event) => setLogoUrl(event.target.value)}
        placeholder="https://…/logo.svg"
        className="w-56 rounded-lg border border-slate-200 px-2 py-1 text-xs"
      />
      {geaendert ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateBrandLogoAction(brand.id, logoUrl.trim());
              if (!result.ok && result.message) {
                window.alert(result.message);
              }
            })
          }
          className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-40"
        >
          {pending ? "Speichert …" : "Logo speichern"}
        </button>
      ) : null}
    </div>
  );
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
        <ul className="space-y-2">
          {brands.map((brand) => (
            <li
              key={brand.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <BrandLogo brand={brand} />
              <span className="font-medium text-slate-900">{brand.name}</span>
              <span className="font-mono text-xs text-slate-400">{brand.code}</span>
              <BrandLogoField brand={brand} />
              <button
                type="button"
                disabled={pending && deleting === brand.id}
                onClick={() => loeschen(brand)}
                className="ml-auto text-xs font-semibold text-red-700 hover:underline disabled:opacity-40"
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="grid gap-4 sm:grid-cols-[2fr,1fr,2fr,auto] sm:items-end">
        <Field label="Neue Marke *" hint="z. B. Volkswagen">
          <input name="name" required minLength={2} className={inputClass} />
        </Field>
        <Field label="Code *" hint="z. B. VW">
          <input name="code" required minLength={2} maxLength={10} className={inputClass} />
        </Field>
        <Field label="Logo" hint="Verweis auf eine Bilddatei, optional">
          <input name="logoUrl" type="url" placeholder="https://…/logo.svg" className={inputClass} />
        </Field>
        <SubmitButton>Marke anlegen</SubmitButton>
      </form>
      <FormAlert state={state} />
    </div>
  );
}
