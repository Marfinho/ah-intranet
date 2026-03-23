import { businessCardFields } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/ui";

export default function AdminFormsPage() {
  return (
    <AppShell title="Admin · Formulare" subtitle="Dynamische Feldkonfiguration für Visitenkarten ohne harte Verdrahtung im Code">
      <Section title="Felddefinitionen" subtitle="Felder können sortiert, deaktiviert oder als Pflichtfeld markiert werden">
        <DataTable
          rows={businessCardFields}
          columns={[
            { key: "label", header: "Feld", render: (field) => <div><p className="font-semibold text-slate-900">{field.label}</p><p className="text-xs text-slate-500">Key: {field.key}</p></div> },
            { key: "type", header: "Typ", render: (field) => field.type },
            { key: "required", header: "Pflicht", render: (field) => (field.required ? "Ja" : "Nein") },
            { key: "active", header: "Aktiv", render: (field) => (field.active ? "Ja" : "Nein") },
            { key: "sort", header: "Sortierung", render: (field) => field.sortOrder },
          ]}
        />
      </Section>
    </AppShell>
  );
}
