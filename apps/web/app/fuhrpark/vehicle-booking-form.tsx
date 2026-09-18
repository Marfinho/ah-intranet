"use client";

import { useFormState } from "react-dom";
import type { Vehicle } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { bookVehicleAction, type ActionState } from "@/lib/actions";
import { toLocalInput } from "@/lib/utils";

const initialState: ActionState = { ok: true };

export function VehicleBookingForm({ vehicles }: { vehicles: Vehicle[] }) {
  const [state, formAction] = useFormState(bookVehicleAction, initialState);

  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Fahrzeug *">
        <select name="vehicleId" required className={inputClass}>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.label} ({vehicle.plate})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Zweck *">
        <input name="purpose" required minLength={3} className={inputClass} placeholder="z. B. Kundenauslieferung" />
      </Field>

      <Field label="Von *">
        <input name="startsAt" type="datetime-local" required defaultValue={toLocalInput(start)} className={inputClass} />
      </Field>

      <Field label="Bis *">
        <input name="endsAt" type="datetime-local" required defaultValue={toLocalInput(end)} className={inputClass} />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Fahrzeug reservieren</SubmitButton>
      </div>
    </form>
  );
}
