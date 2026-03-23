"use client";

import { useMemo, useState } from "react";
import type { WorkwearCatalogItem } from "@ah-intranet/shared";

interface OrderSelection {
  size: string;
  quantity: number;
}

export function WorkwearOrderForm({ items }: { items: WorkwearCatalogItem[] }) {
  const [selection, setSelection] = useState<Record<string, OrderSelection>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function updateItem(itemId: string, patch: Partial<OrderSelection>) {
    setSelection((current) => ({
      ...current,
      [itemId]: {
        size: current[itemId]?.size ?? "",
        quantity: current[itemId]?.quantity ?? 0,
        ...patch,
      },
    }));
  }

  const summary = useMemo(
    () =>
      items
        .map((item) => ({ item, selection: selection[item.id] }))
        .filter((entry) => entry.selection?.quantity),
    [items, selection],
  );

  function handleSubmit() {
    if (summary.length === 0) {
      setError("Bitte wählen Sie mindestens einen Artikel mit Menge aus.");
      setSubmitted(false);
      return;
    }

    const invalid = summary.find((entry) => !entry.selection?.size);
    if (invalid) {
      setError(`Bitte wählen Sie für ${invalid.item.name} eine Größe aus.`);
      setSubmitted(false);
      return;
    }

    setError("");
    setSubmitted(true);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1.6fr_1fr_120px] md:items-center">
            <div>
              <p className="font-semibold text-slate-900">{item.name}</p>
              <p className="text-sm text-slate-600">{item.description}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">{item.category}</p>
            </div>
            <select
              value={selection[item.id]?.size ?? ""}
              onChange={(event) => updateItem(item.id, { size: event.target.value })}
              className="rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="">Größe wählen</option>
              {item.sizes.map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={selection[item.id]?.quantity ?? 0}
              onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })}
              className="rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSubmit} className="rounded-2xl bg-brand-600 px-5 py-3 font-semibold text-white">Bestellung einreichen</button>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}
      {submitted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Bestellung erfolgreich vorbereitet. Die Positionen können im MVP jetzt zur Freigabe eingereicht werden.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="font-semibold text-slate-900">Bestellzusammenfassung</p>
        <div className="mt-3 space-y-3">
          {summary.length === 0 ? (
            <p className="text-sm text-slate-600">Noch keine Positionen ausgewählt.</p>
          ) : (
            summary.map(({ item, selection }) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{item.name}</span> · Größe {selection?.size} · Menge {selection?.quantity}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
