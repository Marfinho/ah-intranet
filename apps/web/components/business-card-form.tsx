"use client";

import { useMemo, useState } from "react";
import type { BusinessCardFieldDefinition } from "@ah-intranet/shared";

function getInitialValues(fields: BusinessCardFieldDefinition[]) {
  return Object.fromEntries(fields.map((field) => [field.key, field.type === "checkbox" ? false : ""]));
}

export function BusinessCardForm({ fields }: { fields: BusinessCardFieldDefinition[] }) {
  const activeFields = useMemo(
    () => [...fields].filter((field) => field.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [fields],
  );
  const [values, setValues] = useState<Record<string, string | boolean>>(() => getInitialValues(activeFields));
  const [quantity, setQuantity] = useState(100);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function updateValue(key: string, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = activeFields
      .filter((field) => field.required)
      .filter((field) => {
        const value = values[field.key];
        return field.type === "checkbox" ? !value : String(value ?? "").trim().length === 0;
      })
      .map((field) => `${field.label} ist ein Pflichtfeld.`);

    if (quantity < 50) {
      nextErrors.push("Die Auflage muss mindestens 50 Stück betragen.");
    }

    setErrors(nextErrors);
    setSubmitted(nextErrors.length === 0);
  }

  return (
    <div className="space-y-5">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        {activeFields.map((field) => (
          <label key={field.key} className="text-sm font-medium text-slate-700">
            {field.label} {field.required ? "*" : ""}
            {field.type === "select" ? (
              <select
                value={String(values[field.key] ?? "")}
                onChange={(event) => updateValue(field.key, event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              >
                <option value="">Bitte auswählen</option>
                {(field.options ?? []).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={Boolean(values[field.key])}
                  onChange={(event) => updateValue(field.key, event.target.checked)}
                />
                <span>Aktivieren</span>
              </div>
            ) : (
              <input
                value={String(values[field.key] ?? "")}
                onChange={(event) => updateValue(field.key, event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder={field.label}
                type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
              />
            )}
            {field.helpText ? <span className="mt-2 block text-xs font-normal text-slate-500">{field.helpText}</span> : null}
          </label>
        ))}
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Auflage
          <input
            type="number"
            min={50}
            step={50}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 md:max-w-xs"
          />
        </label>
        <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
          <button type="button" className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700">Als Entwurf speichern</button>
          <button type="submit" className="rounded-2xl bg-brand-600 px-5 py-3 font-semibold text-white">Bestellung einreichen</button>
        </div>
      </form>

      {errors.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Bitte prüfen</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {submitted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Bestellung erfolgreich vorbereitet</p>
          <p className="mt-1">Die Bestellung wurde validiert und kann im MVP-Freigabeprozess eingereicht werden.</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="font-semibold text-slate-900">Live-Vorschau der Konfiguration</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {activeFields.map((field) => (
            <div key={field.key} className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">{field.label}</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {field.type === "checkbox" ? (Boolean(values[field.key]) ? "Ja" : "Nein") : String(values[field.key] || "—")}
              </p>
            </div>
          ))}
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Auflage</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{quantity} Stück</p>
          </div>
        </div>
      </div>
    </div>
  );
}
