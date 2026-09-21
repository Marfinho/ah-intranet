"use client";

import { useState, useTransition } from "react";
import { deleteLocationAction, updateLocationAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

interface Brand {
  id: string;
  name: string;
  code: string;
}

interface LocationSummary {
  id: string;
  name: string;
  code: string;
  address: string | null;
  brands: Brand[];
}

/**
 * Ein Standort mit anklickbaren Marken-Tags.
 *
 * Ändert sich die Auswahl, wirkt das sofort auf die Zielgruppen-Tokens der
 * Konten an diesem Standort - ihre Sitzungen enden beim Speichern, genau wie
 * bei einer Rechteänderung.
 */
export function LocationRow({ location, allBrands }: { location: LocationSummary; allBrands: Brand[] }) {
  const [selected, setSelected] = useState<string[]>(location.brands.map((brand) => brand.id));
  const [pending, startTransition] = useTransition();

  const geaendert =
    selected.length !== location.brands.length || selected.some((id) => !location.brands.some((brand) => brand.id === id));

  const melde = (result: { ok: boolean; message?: string }) => {
    if (!result.ok && result.message) {
      window.alert(result.message);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{location.name}</p>
          <p className="mt-1 text-sm text-slate-600">{location.address ?? "Keine Adresse hinterlegt"}</p>
          <p className="mt-1 font-mono text-xs text-slate-400">{location.code}</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Standort "${location.name}" wirklich löschen?`)) {
              startTransition(async () => melde(await deleteLocationAction(location.id)));
            }
          }}
          className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-40"
        >
          Standort löschen
        </button>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Marken</p>
        {allBrands.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Noch keine Marken angelegt.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {allBrands.map((brand) => {
              const active = selected.includes(brand.id);
              return (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() =>
                    setSelected((current) =>
                      current.includes(brand.id) ? current.filter((id) => id !== brand.id) : [...current, brand.id],
                    )
                  }
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-medium transition",
                    active
                      ? "border-brand-600 bg-brand-50 text-brand-800"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {brand.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {geaendert ? (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => melde(await updateLocationAction(location.id, { brandIds: selected })))
            }
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Speichert …" : "Marken speichern"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(location.brands.map((brand) => brand.id))}
            className="text-sm font-semibold text-slate-600 hover:underline"
          >
            Zurücksetzen
          </button>
        </div>
      ) : null}
    </div>
  );
}
