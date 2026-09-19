import type { BusinessCardFieldDefinition } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section, Tag } from "@/components/ui";
import { FieldDefinitionForm } from "./field-definition-form";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";

export default async function FormsAdminPage() {
  await requirePermission("catalog.manage");
  const fields = await apiGet<BusinessCardFieldDefinition[]>("/orders/catalog/business-card-fields");

  return (
    <AppShell title="Visitenkartenformular" subtitle="Felder, Pflichtangaben und Reihenfolge konfigurieren">
      <Section title="Feld anlegen oder ändern" subtitle="Der Schlüssel identifiziert das Feld dauerhaft">
        <FieldDefinitionForm nextSortOrder={fields.length} />
      </Section>

      <Section title={`${fields.length} Felder`} subtitle="Inaktive Felder erscheinen nicht im Bestellformular">
        {fields.length === 0 ? (
          <EmptyState title="Kein Formular" detail="Legen Sie oben das erste Feld an." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Schlüssel</th>
                  <th className="px-4 py-3 font-semibold">Beschriftung</th>
                  <th className="px-4 py-3 font-semibold">Typ</th>
                  <th className="px-4 py-3 font-semibold">Eigenschaften</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {fields.map((field) => (
                  <tr key={field.id}>
                    <td className="px-4 py-3 text-slate-500">{field.sortOrder}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{field.key}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{field.label}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {field.type}
                      {field.options.length > 0 ? ` (${field.options.length} Optionen)` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap gap-2">
                        {field.required ? <Tag>Pflichtfeld</Tag> : null}
                        {!field.active ? <span className="badge bg-rose-100 text-rose-800">inaktiv</span> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </AppShell>
  );
}
