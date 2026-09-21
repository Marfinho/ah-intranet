import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { LocationComposer } from "./location-composer";
import { DepartmentComposer } from "./department-composer";

interface Organisation {
  locations: { id: string; name: string; code: string; address: string | null }[];
  departments: { id: string; name: string; code: string }[];
  maxLocations: number | null;
}

/**
 * Selbstständiger Aufbau durch das Haus: Autohäuser (Standorte) und
 * Abteilungen anlegen - Standorte nur innerhalb der Lizenzgrenze, die
 * ausschließlich die Plattformverwaltung setzt (siehe Verwaltung → Autohäuser).
 */
export default async function OrganisationAdminPage() {
  await requirePermission("organisation.manage");
  const organisation = await apiGet<Organisation>("/users/organisation");

  const grenze = organisation.maxLocations;
  const ausgeschoepft = typeof grenze === "number" && organisation.locations.length >= grenze;

  return (
    <AppShell title="Organisation" subtitle="Standorte und Abteilungen Ihres Hauses">
      <Section
        title={`${organisation.locations.length} Standort(e)${
          typeof grenze === "number" ? ` von ${grenze} lizenziert` : ""
        }`}
        subtitle="Jedes Autohaus Ihrer Gruppe ist ein eigener Standort"
      >
        {organisation.locations.length === 0 ? (
          <EmptyState title="Noch kein Standort" detail="Legen Sie unten den ersten Standort an." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Kürzel</th>
                  <th className="pb-2">Adresse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {organisation.locations.map((location) => (
                  <tr key={location.id}>
                    <td className="py-3 font-medium text-slate-900">{location.name}</td>
                    <td className="py-3 font-mono text-xs text-slate-600">{location.code}</td>
                    <td className="py-3 text-slate-600">{location.address ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Standort anlegen"
        subtitle={
          ausgeschoepft
            ? `Lizenzgrenze von ${grenze} Standort(en) erreicht - wenden Sie sich an die Plattformverwaltung für mehr.`
            : "Neues Autohaus Ihrer Gruppe eintragen"
        }
      >
        {ausgeschoepft ? (
          <EmptyState
            title="Lizenzgrenze erreicht"
            detail="Für weitere Standorte wenden Sie sich bitte an die Plattformverwaltung."
          />
        ) : (
          <LocationComposer />
        )}
      </Section>

      <Section title={`${organisation.departments.length} Abteilung(en)`} subtitle="Ohne Lizenzgrenze">
        {organisation.departments.length === 0 ? (
          <EmptyState title="Noch keine Abteilung" detail="Legen Sie unten die erste Abteilung an." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Kürzel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {organisation.departments.map((department) => (
                  <tr key={department.id}>
                    <td className="py-3 font-medium text-slate-900">{department.name}</td>
                    <td className="py-3 font-mono text-xs text-slate-600">{department.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Abteilung anlegen" subtitle="Neue Abteilung Ihres Hauses eintragen">
        <DepartmentComposer />
      </Section>
    </AppShell>
  );
}
