"use client";

import { useFormState } from "react-dom";
import type { TenantSummary } from "@ah-intranet/shared";
import { FormAlert, SubmitButton } from "@/components/forms";
import { setTenantLicenseAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };
const numberInputClass = "w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm";

/**
 * Lizenzgrenzen eines Hauses: höchstens so viele Standorte und Benutzerkonten.
 * Leeres Feld heißt unbegrenzt - das Haus baut sich innerhalb dieser Grenze
 * selbst aus (siehe Verwaltung → Organisation im Haus).
 */
export function TenantLicenseForm({ tenant }: { tenant: TenantSummary }) {
  const [state, formAction] = useFormState(setTenantLicenseAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={tenant.id} />
      <label className="text-xs text-slate-500">
        Standorte (jetzt {tenant.locationCount})
        <input
          name="maxLocations"
          type="number"
          min={0}
          defaultValue={tenant.maxLocations ?? ""}
          placeholder="unbegrenzt"
          className={`mt-1 block ${numberInputClass}`}
        />
      </label>
      <label className="text-xs text-slate-500">
        Konten (jetzt {tenant.userCount})
        <input
          name="maxUsers"
          type="number"
          min={0}
          defaultValue={tenant.maxUsers ?? ""}
          placeholder="unbegrenzt"
          className={`mt-1 block ${numberInputClass}`}
        />
      </label>
      <SubmitButton variant="ghost">Speichern</SubmitButton>
      <div className="basis-full">
        <FormAlert state={state} />
      </div>
    </form>
  );
}
