import { allOrders } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { OrdersTableClient } from "@/components/orders-table-client";
import { Section } from "@/components/ui";

export default function AdminOrdersPage() {
  return (
    <AppShell title="Admin · Bestellungen" subtitle="Einsehen, freigeben, ablehnen, bündeln und extern bestellen">
      <Section title="Operative Bestellungen" subtitle="Vorbereitet für Pagination, Suche und Filter in größeren Datenmengen">
        <OrdersTableClient rows={allOrders} />
      </Section>
    </AppShell>
  );
}
