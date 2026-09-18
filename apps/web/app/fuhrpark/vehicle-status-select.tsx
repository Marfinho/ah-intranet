"use client";

import { useTransition } from "react";
import type { VehicleBooking } from "@ah-intranet/shared";
import { setVehicleBookingStatusAction } from "@/lib/actions";

/** Übergabestatus einer Reservierung fortschreiben. */
export function VehicleStatusSelect({ booking }: { booking: VehicleBooking }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={booking.status}
      disabled={pending}
      aria-label={`Status der Reservierung ${booking.plate}`}
      onChange={(event) => {
        const status = event.target.value;
        startTransition(async () => {
          const result = await setVehicleBookingStatusAction(booking.id, status);
          if (!result.ok && result.message) {
            window.alert(result.message);
          }
        });
      }}
      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
    >
      <option value="reserviert">Reserviert</option>
      <option value="abgeholt">Abgeholt</option>
      <option value="zurueckgegeben">Zurückgegeben</option>
      <option value="storniert">Storniert</option>
    </select>
  );
}
