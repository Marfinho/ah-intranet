import type { OrderCycleInfo, OrderSummary, WorkwearCatalogItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section, StatusBadge } from "@/components/ui";
import { WorkwearForm } from "./workwear-form";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";

interface CatalogResponse {
  catalog: WorkwearCatalogItem[];
  nextCycle: OrderCycleInfo | null;
  existingOrders: OrderSummary[];
}

export default async function WorkwearPage() {
  await requireModule("orders");
  const data = await apiGet<CatalogResponse>("/orders/workwear/catalog");

  return (
    <AppShell title="Arbeitskleidung bestellen" subtitle="Aus dem freigegebenen Katalog wählen und Mengen erfassen">
      <Section
        title="Neue Bestellung"
        subtitle={
          data.nextCycle
            ? `Nächste Sammelbestellung am ${formatDate(data.nextCycle.nextOrderDate)} · ${data.nextCycle.notes ?? ""}`
            : "Derzeit ist kein Sammelbestelltermin hinterlegt."
        }
      >
        {data.catalog.length === 0 ? (
          <EmptyState title="Katalog ist leer" detail="Die Administration hat noch keine Artikel freigegeben." />
        ) : (
          <WorkwearForm catalog={data.catalog} />
        )}
      </Section>

      <Section title="Ihre bisherigen Kleidungsbestellungen" subtitle="Die letzten zehn Vorgänge">
        {data.existingOrders.length === 0 ? (
          <EmptyState title="Keine früheren Bestellungen" detail="Ihre erste Bestellung erscheint nach dem Absenden hier." />
        ) : (
          <ul className="space-y-3">
            {data.existingOrders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                  <p className="text-sm text-slate-600">
                    {order.summary} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
