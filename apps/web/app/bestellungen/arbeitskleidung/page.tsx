import { orderCycles, workwearCatalog, workwearOrders } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { Timeline } from "@/components/timeline";
import { OrderComments } from "@/components/order-comments";
import { InfoList, Section, StatusBadge } from "@/components/ui";
import { WorkwearOrderForm } from "@/components/workwear-order-form";
import { formatDate } from "@/lib/utils";

const nextCycle = orderCycles.find((cycle) => cycle.type === "workwear")!;
const latestOrder = workwearOrders[0];

export default function WorkwearPage() {
  return (
    <AppShell title="Arbeitskleidung" subtitle="Pflegbarer Katalog, Größenwahl, Mengen und transparente Bestellhistorie">
      <Section title="Neue Bestellung" subtitle={`Nächste Sammelbestellung: ${formatDate(nextCycle.nextOrderDate)}`}>
        <WorkwearOrderForm items={workwearCatalog} />
      </Section>

      <Section title="MVP-Regeln" subtitle="Einfacher Freigabeprozess ohne Lagerbestand oder Budgetprüfung im MVP">
        <InfoList
          items={[
            { label: "Freigabe", value: "1-stufig durch Admin" },
            { label: "Lagerbestand", value: "Nicht Bestandteil des MVP" },
            { label: "Budgetprüfung", value: "Nicht Bestandteil des MVP" },
            { label: "Externe Sammelbestellung", value: "Nach Freigabe separat durch Admin bestätigt" },
          ]}
        />
      </Section>

      <Section title="Bestellhistorie" subtitle="Eigene Arbeitskleidungsbestellungen inklusive Statushistorie">
        <DataTable
          rows={workwearOrders}
          columns={[
            {
              key: "id",
              header: "Bestellung",
              render: (order) => (
                <div>
                  <p className="font-semibold text-slate-900">{order.id}</p>
                  <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                </div>
              ),
            },
            { key: "status", header: "Status", render: (order) => <StatusBadge status={order.status} /> },
            { key: "items", header: "Positionen", render: (order) => `${order.itemCount} Artikel` },
            { key: "cycle", header: "Nächster Zyklus", render: (order) => formatDate(order.nextCycle) },
            {
              key: "detail",
              header: "Inhalt",
              render: (order) => order.items.map((item) => `${item.itemName} ${item.size} × ${item.quantity}`).join(", "),
            },
          ]}
        />
      </Section>

      <Section title={`Bearbeitungsverlauf · ${latestOrder.id}`} subtitle="Transparenter Verlauf bis zur externen Sammelbestellung">
        <Timeline items={latestOrder.timeline} />
      </Section>

      <Section title={`Kommentare · ${latestOrder.id}`} subtitle="Rückfragen und Hinweise zwischen Besteller und Administration">
        <OrderComments comments={latestOrder.comments} />
      </Section>
    </AppShell>
  );
}
