import type { BusinessCardFieldDefinition, OrderCycleInfo, OrderSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section, StatusBadge } from "@/components/ui";
import { BusinessCardForm } from "./business-card-form";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";

interface ConfigResponse {
  fields: BusinessCardFieldDefinition[];
  nextCycle: OrderCycleInfo | null;
  existingOrders: OrderSummary[];
}

export default async function BusinessCardPage() {
  const session = await requireModule("orders");
  const config = await apiGet<ConfigResponse>("/orders/business-cards/config");

  return (
    <AppShell title="Visitenkarten bestellen" subtitle="Die Felder sind vom Marketing vorgegeben und zentral gepflegt">
      <Section
        title="Neue Bestellung"
        subtitle={
          config.nextCycle
            ? `Nächste Sammelbestellung am ${formatDate(config.nextCycle.nextOrderDate)} · ${config.nextCycle.notes ?? ""}`
            : "Derzeit ist kein Sammelbestelltermin hinterlegt."
        }
      >
        {config.fields.length === 0 ? (
          <EmptyState
            title="Kein Formular hinterlegt"
            detail="Die Administration hat noch keine Visitenkartenfelder konfiguriert."
          />
        ) : (
          <BusinessCardForm
            fields={config.fields}
            defaults={{
              fullName: session.displayName,
              jobTitle: session.jobTitle ?? "",
              location: session.location ?? "",
              email: session.email ?? "",
            }}
          />
        )}
      </Section>

      <Section title="Ihre bisherigen Visitenkartenbestellungen" subtitle="Die letzten zehn Vorgänge">
        {config.existingOrders.length === 0 ? (
          <EmptyState
            title="Keine früheren Bestellungen"
            detail="Ihre erste Bestellung erscheint nach dem Absenden hier."
          />
        ) : (
          <ul className="space-y-3">
            {config.existingOrders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"
              >
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
