import { workwearCatalog } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/ui";

export default function AdminCatalogPage() {
  return (
    <AppShell title="Admin · Katalog" subtitle="Pflege des Arbeitskleidungs-Katalogs inklusive Größen und Aktivstatus">
      <Section title="Katalogeinträge" subtitle="Optional erweiterbar um Farbe, Fit, Geschlecht oder Lieferanteninformationen">
        <DataTable
          rows={workwearCatalog}
          columns={[
            { key: "name", header: "Artikel", render: (item) => <div><p className="font-semibold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.description}</p></div> },
            { key: "category", header: "Kategorie", render: (item) => item.category },
            { key: "sizes", header: "Größen", render: (item) => item.sizes.join(", ") },
            { key: "variants", header: "Varianten", render: (item) => item.variants?.join(", ") ?? "–" },
            { key: "active", header: "Status", render: (item) => (item.active ? "Aktiv" : "Inaktiv") },
          ]}
        />
      </Section>
    </AppShell>
  );
}
