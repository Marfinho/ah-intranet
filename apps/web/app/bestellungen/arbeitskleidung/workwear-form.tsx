"use client";

import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import type { WorkwearCatalogItem } from "@ah-intranet/shared";
import { FormAlert, SubmitButton } from "@/components/forms";
import { createWorkwearOrderAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/**
 * Pro Artikel wird eine Größe gewählt und eine Menge gesetzt. Das Feld heißt
 * `item:<artikelId>:<groesse>`, damit die Server Action die Positionen ohne
 * zusätzliches Schema wieder zusammensetzen kann.
 */
export function WorkwearForm({ catalog }: { catalog: WorkwearCatalogItem[] }) {
  const [state, formAction] = useFormState(createWorkwearOrderAction, initialState);
  const [sizes, setSizes] = useState<Record<string, string>>(() =>
    Object.fromEntries(catalog.map((item) => [item.id, item.sizes[0] ?? ""])),
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const categories = useMemo(() => [...new Set(catalog.map((item) => item.category))], [catalog]);
  const total = Object.values(quantities).reduce((sum, value) => sum + (value || 0), 0);

  return (
    <form action={formAction} className="space-y-6">
      {categories.map((category) => (
        <div key={category}>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{category}</p>
          <div className="space-y-3">
            {catalog
              .filter((item) => item.category === category)
              .map((item) => {
                const size = sizes[item.id] ?? item.sizes[0] ?? "";
                const quantity = quantities[item.id] ?? 0;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      {item.description ? <p className="text-sm text-slate-600">{item.description}</p> : null}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-slate-500">
                        Größe
                        <select
                          value={size}
                          onChange={(event) => setSizes((current) => ({ ...current, [item.id]: event.target.value }))}
                          className="ml-2 min-h-ziel rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
                          aria-label={`Größe für ${item.name}`}
                        >
                          {item.sizes.map((entry) => (
                            <option key={entry} value={entry}>
                              {entry}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs font-medium text-slate-500">
                        Menge
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={quantity || ""}
                          placeholder="0"
                          onChange={(event) =>
                            setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))
                          }
                          className="ml-2 w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                          aria-label={`Menge für ${item.name}`}
                        />
                      </label>

                      {/* Nur Positionen mit Menge landen im Formular. */}
                      {quantity > 0 && size ? (
                        <input type="hidden" name={`item:${item.id}:${size}`} value={quantity} />
                      ) : null}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      <FormAlert state={state} />

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>Bestellung einreichen</SubmitButton>
        <span className="text-sm text-slate-600">{total} Stück ausgewählt</span>
      </div>
    </form>
  );
}
