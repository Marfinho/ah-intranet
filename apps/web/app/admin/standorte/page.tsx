import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { LocationComposer } from "./location-composer";
import { LocationRow } from "./location-row";
import { BrandManager } from "./brand-manager";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";

interface Brand {
  id: string;
  name: string;
  code: string;
}

interface LocationSummary {
  id: string;
  name: string;
  code: string;
  address: string | null;
  brands: Brand[];
}

export default async function StandorteAdminPage() {
  await requirePermission("org.manage");

  const [locations, brands] = await Promise.all([
    apiGet<LocationSummary[]>("/standorte"),
    apiGet<Brand[]>("/marken"),
  ]);

  return (
    <AppShell
      title="Standorte & Marken"
      subtitle="Standorte pflegen und die Marken zuordnen, die sie führen - steuert u. a., welche News einen Standort erreichen"
    >
      <Section title="Neuer Standort" subtitle="Marken direkt bei der Anlage anklicken, oder später ergänzen">
        <LocationComposer brands={brands} />
      </Section>

      <Section
        title={`${locations.length} Standorte`}
        subtitle="Marken ändern sich sofort in den Zielgruppen - betroffene Konten werden abgemeldet"
      >
        {locations.length === 0 ? (
          <EmptyState title="Noch keine Standorte" detail="Legen Sie oben den ersten Standort an." />
        ) : (
          <div className="space-y-4">
            {locations.map((location) => (
              <LocationRow key={location.id} location={location} allBrands={brands} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Marken" subtitle="Frei angelegte Tags, die ein Standort führen kann">
        <BrandManager brands={brands} />
      </Section>
    </AppShell>
  );
}
