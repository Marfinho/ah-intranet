import type { Vehicle, VehicleBooking } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section, StatusBadge } from "@/components/ui";
import { VehicleBookingForm } from "./vehicle-booking-form";
import { VehicleStatusSelect } from "./vehicle-status-select";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";
import { formatRange } from "@/lib/utils";

interface VehiclesResponse {
  vehicles: Vehicle[];
  bookings: VehicleBooking[];
}

const CATEGORY_LABELS: Record<string, string> = {
  vorfuehrwagen: "Vorführwagen",
  werkstattersatz: "Werkstattersatzwagen",
  poolfahrzeug: "Poolfahrzeug",
};

export default async function VehiclesPage({ searchParams }: { searchParams: { category?: string } }) {
  const session = await requireModule("vehicles");

  const query = new URLSearchParams();
  if (searchParams.category) query.set("category", searchParams.category);

  const data = await apiGet<VehiclesResponse>(`/vehicles?${query.toString()}`);

  return (
    <AppShell title="Fuhrpark" subtitle="Vorführ-, Ersatz- und Poolfahrzeuge reservieren">
      <Section title="Fahrzeug reservieren" subtitle="Doppelbelegungen werden automatisch verhindert">
        {data.vehicles.length === 0 ? (
          <EmptyState title="Keine Fahrzeuge" detail="Für diese Kategorie ist kein Fahrzeug hinterlegt." />
        ) : (
          <VehicleBookingForm vehicles={data.vehicles} />
        )}
      </Section>

      <Section title={`${data.vehicles.length} Fahrzeuge`} subtitle="Nach Kategorie filtern">
        <div className="space-y-4">
          <FilterBar
            showSearch={false}
            selects={[
              {
                name: "category",
                label: "Alle Kategorien",
                options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
              },
            ]}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.vehicles.map((vehicle) => (
              <article key={vehicle.id} className="rounded-2xl border border-slate-200 p-5">
                <p className="font-semibold text-slate-900">{vehicle.label}</p>
                <p className="mt-1 font-mono text-sm text-slate-600">{vehicle.plate}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {CATEGORY_LABELS[vehicle.category] ?? vehicle.category} · {vehicle.location ?? "ohne Standort"}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <Section title={`${data.bookings.length} anstehende Reservierungen`} subtitle="Übergaben hier dokumentieren">
        {data.bookings.length === 0 ? (
          <EmptyState title="Keine Reservierungen" detail="Alle Fahrzeuge sind aktuell verfügbar." />
        ) : (
          <ul className="space-y-3">
            {data.bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {booking.vehicleLabel} · <span className="font-mono">{booking.plate}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {booking.purpose} · {booking.driver}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatRange(booking.startsAt, booking.endsAt)}</p>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={booking.status} />
                  {booking.driverUsername === session.username || session.roles.includes("admin") ? (
                    <VehicleStatusSelect booking={booking} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
