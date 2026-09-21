"use client";

import { useActionState } from "react";
import type { BusinessCardFieldDefinition } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createBusinessCardOrderAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/**
 * Das Formular baut sich aus den Felddefinitionen der API auf. Die Prüfung im
 * Browser ist reiner Komfort - verbindlich validiert die API.
 */
export function BusinessCardForm({
  fields,
  defaults,
}: {
  fields: BusinessCardFieldDefinition[];
  defaults: Record<string, string>;
}) {
  const [state, formAction] = useActionState(createBusinessCardOrderAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      {fields.map((field) => {
        const name = `field:${field.key}`;
        const defaultValue = defaults[field.key] ?? "";

        if (field.type === "checkbox") {
          return (
            <label
              key={field.key}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 md:col-span-2"
            >
              <input type="checkbox" name={name} value="true" className="mt-1 h-4 w-4" />
              <span>
                <span className="font-medium">{field.label}</span>
                {field.helpText ? <span className="mt-1 block text-xs text-slate-500">{field.helpText}</span> : null}
              </span>
            </label>
          );
        }

        if (field.type === "select") {
          return (
            <Field
              key={field.key}
              label={`${field.label}${field.required ? " *" : ""}`}
              hint={field.helpText ?? undefined}
            >
              <select name={name} required={field.required} defaultValue={defaultValue} className={inputClass}>
                <option value="">Bitte auswählen</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          );
        }

        return (
          <Field
            key={field.key}
            label={`${field.label}${field.required ? " *" : ""}`}
            hint={field.helpText ?? undefined}
          >
            <input
              name={name}
              type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
              required={field.required}
              defaultValue={defaultValue}
              className={inputClass}
            />
          </Field>
        );
      })}

      <Field label="Auflage *" hint="Mindestens 50, höchstens 5000 Stück">
        <input
          name="quantity"
          type="number"
          min={50}
          max={5000}
          step={50}
          defaultValue={100}
          required
          className={inputClass}
        />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Bestellung einreichen</SubmitButton>
      </div>
    </form>
  );
}
