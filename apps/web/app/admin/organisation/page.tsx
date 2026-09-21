import { AppShell } from "@/components/app-shell";
import { EmptyState, Section, Tag } from "@/components/ui";
import { LocationForm } from "./location-form";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";

interface LocationRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
}

export default async function OrganisationPage() {
  await requirePermission("users.manage");
  const { locations } = await apiGet<{ locations: LocationRow[] }>("/users/organisation");

  return (
    <AppShell title="Organisation" subtitle="Standorte des Hauses">
      <Section title="Standort anlegen" subtitle="Mindestens ein Standort wird für die Ersteinrichtung gebraucht">
        <LocationForm />
      </Section>

      <Section title="Vorhandene Standorte">
        {locations.length === 0 ? (
          <EmptyState title="Noch kein Standort" detail="Legen Sie oben den ersten Standort an." />
        ) : (
          <ul className="space-y-3">
            {locations.map((location) => (
              <li
                key={location.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 p-4"
              >
                <div>
                  <p className="font-semibold text-slate-900">{location.name}</p>
                  <p className="text-sm text-slate-600">{location.address ?? "Keine Adresse hinterlegt"}</p>
                </div>
                <Tag>{location.code}</Tag>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
