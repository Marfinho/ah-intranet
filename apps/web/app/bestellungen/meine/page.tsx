import { allOrders, currentUser } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { OrdersTableClient } from "@/components/orders-table-client";
import { Section } from "@/components/ui";

const ownOrders = allOrders.filter((order) => order.employeeUsername === currentUser.username || order.employee === currentUser.displayName);

export default function MyOrdersPage() {
  return (
    <AppShell title="Meine Bestellungen" subtitle="Eigene Bestellungen inklusive Status- und Bearbeitungsverlauf">
      <Section title="Bestellübersicht" subtitle="Visitenkarten und Arbeitskleidung in einer gemeinsamen Historie">
        <OrdersTableClient rows={ownOrders} compact />
      </Section>
    </AppShell>
  );
}
