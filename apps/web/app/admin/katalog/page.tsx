import type { WorkwearCatalogItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section, Tag } from "@/components/ui";
import { CatalogItemForm } from "./catalog-item-form";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/session";

export default async function CatalogAdminPage() {
  await requireRole("admin", "fachbereichsadmin");
  const catalog = await apiGet<WorkwearCatalogItem[]>("/orders/catalog/workwear");

  return (
    <AppShell title="Arbeitskleidungskatalog" subtitle="Artikel und verfügbare Größen pflegen">
      <Section title="Artikel anlegen oder ändern" subtitle="Vorhandene Artikel über die ID bearbeiten">
        <CatalogItemForm />
      </Section>

      <Section title={`${catalog.length} Artikel`} subtitle="Entfernte Größen bleiben für alte Bestellungen erhalten">
        {catalog.length === 0 ? (
          <EmptyState title="Katalog ist leer" detail="Legen Sie oben den ersten Artikel an." />
        ) : (
          <ul className="space-y-3">
            {catalog.map((item) => (
              <li key={item.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.category}
                      {item.description ? ` · ${item.description}` : ""}
                    </p>
                  </div>
                  {!item.active ? <span className="badge bg-rose-100 text-rose-800">inaktiv</span> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.sizes.map((size) => (
                    <Tag key={size}>{size}</Tag>
                  ))}
                </div>

                <p className="mt-3 font-mono text-xs text-slate-400">{item.id}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
