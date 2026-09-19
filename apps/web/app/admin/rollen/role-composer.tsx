"use client";

import { useFormState } from "react-dom";
import type { PermissionSummary } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createRoleAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/** Eigene Rolle anlegen: Name, Beschreibung, Rangfolge, angeklickte Rechte. */
export function RoleComposer({ permissions, bereiche }: { permissions: PermissionSummary[]; bereiche: string[] }) {
  const [state, formAction] = useFormState(createRoleAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Name der Rolle *" hint="z. B. Werkstattleitung">
        <input name="name" required minLength={2} className={inputClass} />
      </Field>

      <Field label="Rangfolge" hint="Höher schlägt niedriger bei der angezeigten Hauptrolle (0–99)">
        <input name="rank" type="number" min={0} max={99} defaultValue={0} className={inputClass} />
      </Field>

      <Field label="Beschreibung" wide hint="Was diese Rolle im Haus tut">
        <input name="description" className={inputClass} placeholder="Leitet die Werkstatt und gibt Anträge frei" />
      </Field>

      <Field label="Rechte" wide hint="Was die Rolle darf – jederzeit änderbar">
        <div className="mt-2 space-y-4">
          {bereiche.map((bereich) => {
            const gruppe = permissions.filter((permission) => permission.bereich === bereich);
            if (gruppe.length === 0) {
              return null;
            }
            return (
              <div key={bereich}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{bereich}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {gruppe.map((permission) => (
                    <label
                      key={permission.key}
                      title={permission.description}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    >
                      <input type="checkbox" name="permissions" value={permission.key} className="h-4 w-4" />
                      {permission.name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Rolle anlegen</SubmitButton>
      </div>
    </form>
  );
}
