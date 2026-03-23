"use client";

import { useState } from "react";
import type { OrderCycleInfo } from "@ah-intranet/shared";

export function OrderCycleEditor({ cycles }: { cycles: OrderCycleInfo[] }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(cycles.map((cycle) => [cycle.id, cycle.nextOrderDate.slice(0, 16)])),
  );
  const [saved, setSaved] = useState(false);

  function updateValue(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      {cycles.map((cycle) => (
        <div key={cycle.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="grid gap-4 md:grid-cols-[1.2fr_220px] md:items-end">
            <div>
              <p className="font-semibold text-slate-900">{cycle.label}</p>
              <p className="text-sm text-slate-600">{cycle.notes}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{cycle.scope}</p>
            </div>
            <label className="text-sm font-medium text-slate-700">
              Nächstes Bestelldatum
              <input
                type="datetime-local"
                value={values[cycle.id] ?? ""}
                onChange={(event) => updateValue(cycle.id, event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </label>
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <button onClick={handleSave} className="rounded-2xl bg-brand-600 px-5 py-3 font-semibold text-white">Bestelltermine speichern</button>
      </div>
      {saved ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Die Termine wurden lokal aktualisiert und sind für den nächsten Verwaltungsschritt vorbereitet.
        </div>
      ) : null}
    </div>
  );
}
