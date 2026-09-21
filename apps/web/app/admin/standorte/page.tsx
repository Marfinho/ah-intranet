import { AppShell } from "@/components/app-shell";
import { EmptyState, Section, Tag } from "@/components/ui";
import { LocationComposer } from "./location-composer";
import { LocationRowActions } from "./location-row-actions";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";

interface LocationRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
}

export default async function LocationsAdminPage() {
  await requirePermission("organisation.manage");
  const locations = await apiGet<LocationRow[]>("/locations");

  return (
    <AppShell title="Standorte verwalten" subtitle="Filialen und Autohäuser dieses Mandanten pflegen">
      <Section
        title="Standort hinzufügen"
        subtitle="Für einen Kunden mit mehreren Häusern - z. B. jede Filiale als eigener Standort"
      >
        <LocationComposer />
      </Section>

      <Section title={`${locations.length} Standorte`}>
        {locations.length === 0 ? (
          <EmptyState title="Keine Standorte" detail="Legen Sie oben den ersten Standort an." />
        ) : (
          <ul className="space-y-3">
            {locations.map((location) => (
              <li
                key={location.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{location.name}</span>
                    <Tag>{location.code}</Tag>
                  </div>
                  {location.address ? <p className="mt-1 text-sm text-slate-600">{location.address}</p> : null}
                </div>

                <LocationRowActions location={location} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
