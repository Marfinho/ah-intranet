import type { VehicleListing } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section, Tag } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";

interface ListingsResponse {
  items: VehicleListing[];
  sources: { key: string; name: string }[];
}

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("de-DE");

export default async function StockPage({ searchParams }: { searchParams: { search?: string; source?: string } }) {
  await requireModule("stock");

  const query = new URLSearchParams();
  if (searchParams.search) query.set("search", searchParams.search);
  if (searchParams.source) query.set("source", searchParams.source);

  const data = await apiGet<ListingsResponse>(`/vehicle-listings?${query.toString()}`);
  const lastSync = data.items.reduce<string | null>(
    (latest, item) => (latest === null || item.syncedAt > latest ? item.syncedAt : latest),
    null,
  );

  return (
    <AppShell title="Fahrzeugbestand" subtitle="Aus DMS und Fahrzeugbörsen zusammengeführt">
      <Section
        title={`${data.items.length} Fahrzeuge`}
        subtitle={
          lastSync
            ? `Zuletzt abgeglichen am ${formatDate(lastSync)} · führend bleiben DMS und Börse`
            : "Noch kein Abgleich gelaufen"
        }
      >
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Marke, Modell oder Fahrgestellnummer"
            selects={[
              {
                name: "source",
                label: "Alle Quellen",
                options: data.sources.map((source) => ({ value: source.key, label: source.name })),
              },
            ]}
          />

          {data.items.length === 0 ? (
            <EmptyState
              title="Kein Bestand vorhanden"
              detail="Richten Sie unter Administration → Schnittstellen den DMS-Dateiaustausch oder mobile.de ein und starten Sie einen Abgleich."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Fahrzeug</th>
                    <th className="px-4 py-3 font-semibold">Erstzulassung</th>
                    <th className="px-4 py-3 font-semibold">Laufleistung</th>
                    <th className="px-4 py-3 font-semibold">Antrieb</th>
                    <th className="px-4 py-3 text-right font-semibold">Preis</th>
                    <th className="px-4 py-3 font-semibold">Quelle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.items.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {vehicle.make} {vehicle.model}
                        </p>
                        <p className="text-xs text-slate-500">{vehicle.title}</p>
                        {vehicle.vin ? <p className="mt-0.5 font-mono text-xs text-slate-400">{vehicle.vin}</p> : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {vehicle.firstRegistration ? formatDate(vehicle.firstRegistration) : "–"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {vehicle.mileageKm === null || vehicle.mileageKm === undefined
                          ? "–"
                          : `${number.format(vehicle.mileageKm)} km`}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {[vehicle.fuel, vehicle.gearbox].filter(Boolean).join(" · ") || "–"}
                        {vehicle.powerKw ? (
                          <span className="block text-xs text-slate-400">
                            {vehicle.powerKw} kW / {Math.round(vehicle.powerKw * 1.36)} PS
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                        {vehicle.price === null || vehicle.price === undefined ? "–" : currency.format(vehicle.price)}
                      </td>
                      <td className="px-4 py-3">
                        {vehicle.url ? (
                          <a
                            href={vehicle.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-700 hover:underline"
                          >
                            {vehicle.sourceName}
                          </a>
                        ) : (
                          <Tag>{vehicle.sourceName}</Tag>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
