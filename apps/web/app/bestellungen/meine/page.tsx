import Link from "next/link";
import { ORDER_STATUSES, type OrderSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section, StatusBadge, statusLabel } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export default async function MyOrdersPage({ searchParams }: { searchParams: { status?: string; search?: string } }) {
  await requireModule("orders");

  const query = new URLSearchParams({ mine: "true" });
  if (searchParams.status) query.set("status", searchParams.status);
  if (searchParams.search) query.set("search", searchParams.search);

  const orders = await apiGet<OrderSummary[]>(`/orders?${query.toString()}`);

  return (
    <AppShell title="Meine Bestellungen" subtitle="Status, Verlauf und Rückfragen zu Ihren Bestellungen">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/bestellungen/visitenkarten"
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Visitenkarten bestellen
        </Link>
        <Link
          href="/bestellungen/arbeitskleidung"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Arbeitskleidung bestellen
        </Link>
      </div>

      <Section title={`${orders.length} Bestellungen`} subtitle="Nach Status filtern oder Bestellnummer suchen">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Bestellnummer suchen"
            selects={[
              {
                name: "status",
                label: "Alle Status",
                options: ORDER_STATUSES.map((value) => ({ value, label: statusLabel(value) })),
              },
            ]}
          />

          {orders.length === 0 ? (
            <EmptyState title="Noch keine Bestellungen" detail="Legen Sie oben eine neue Bestellung an." />
          ) : (
            <ul className="space-y-3">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/bestellungen/${order.id}`}
                    className="block rounded-2xl border border-slate-200 p-5 transition hover:border-brand-100 hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                        <p className="mt-1 text-sm text-slate-600">{order.summary}</p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Erstellt {formatDate(order.createdAt)}
                      {order.nextCycle ? ` · nächste Sammelbestellung ${formatDate(order.nextCycle)}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
