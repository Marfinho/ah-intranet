"use client";

import { useFormState } from "react-dom";
import type { ConnectorState } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { saveConnectorAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/**
 * Konfigurationsformular eines Konnektors.
 *
 * Geheime Felder werden nie vorbefüllt - die API liefert sie gar nicht aus.
 * Ein leeres Passwortfeld lässt den hinterlegten Wert unverändert; zum Löschen
 * gibt es ein eigenes Kästchen, damit das nicht versehentlich passiert.
 */
export function ConnectorForm({ connector }: { connector: ConnectorState }) {
  const [state, formAction] = useFormState(saveConnectorAction.bind(null, connector.key), initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      {connector.fields.map((field) => {
        const stored = connector.secretsSet.includes(field.key);

        if (field.secret) {
          return (
            <div key={field.key} className="md:col-span-2">
              <Field
                label={`${field.label}${field.required ? " *" : ""}`}
                hint={
                  stored
                    ? "Ein Wert ist hinterlegt. Leer lassen, um ihn beizubehalten."
                    : (field.help ?? "Wird verschlüsselt gespeichert.")
                }
              >
                <input
                  name={`secret:${field.key}`}
                  type="password"
                  autoComplete="new-password"
                  placeholder={stored ? "unverändert" : field.placeholder}
                  className={inputClass}
                />
              </Field>
              {stored ? (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" name={`clear:${field.key}`} className="h-4 w-4" />
                  Hinterlegten Wert löschen
                </label>
              ) : null}
            </div>
          );
        }

        return (
          <Field
            key={field.key}
            label={`${field.label}${field.required ? " *" : ""}`}
            hint={field.help}
            wide={field.type === "url"}
          >
            <input
              name={`setting:${field.key}`}
              type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
              defaultValue={connector.settings[field.key] ?? ""}
              placeholder={field.placeholder}
              className={inputClass}
            />
          </Field>
        );
      })}

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Konfiguration speichern</SubmitButton>
      </div>
    </form>
  );
}
