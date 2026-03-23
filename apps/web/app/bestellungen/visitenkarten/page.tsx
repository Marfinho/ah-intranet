import { businessCardFields, businessCardOrders, orderCycles } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { BusinessCardForm } from "@/components/business-card-form";
import { DataTable } from "@/components/data-table";
import { Timeline } from "@/components/timeline";
import { OrderComments } from "@/components/order-comments";
import { InfoList, Section, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const nextCycle = orderCycles.find((cycle) => cycle.type === "business_cards")!;
const latestOrder = businessCardOrders[0];

export default function BusinessCardsPage() {
  return (
    <AppShell title="Visitenkarten" subtitle="Dynamische Feldkonfiguration, Freigabeprozess und Nachbestellung alter Konfigurationen">
      <Section title="Neue Bestellung" subtitle={`Nächste Sammelbestellung: ${formatDate(nextCycle.nextOrderDate)}`}>
        <BusinessCardForm fields={businessCardFields} />
      </Section>

      <Section title="Formular- und Prozesshinweise" subtitle="Administrierbare Felder und klarer 1-stufiger Freigabefluss">
        <InfoList
          items={[
            { label: "Bestellzyklus", value: nextCycle.notes },
            { label: "Freigabe", value: "1-stufig durch Admin" },
            { label: "Externe Bestellung", value: "Separate Admin-Aktion nach Freigabe" },
            { label: "Nachbestellung", value: "Auf Basis früherer Konfigurationen möglich" },
          ]}
        />
      </Section>

      <Section title="Meine Bestellungen" subtitle="Statusanzeige, Auflagen und Nachbestellung aus vorhandenen Konfigurationen">
        <DataTable
          rows={businessCardOrders}
          columns={[
            {
              key: "id",
              header: "Bestellung",
              render: (order) => (
                <div>
                  <p className="font-semibold text-slate-900">{order.id}</p>
                  <p className="text-xs text-slate-500">Erstellt am {formatDate(order.createdAt)}</p>
                </div>
              ),
            },
            { key: "status", header: "Status", render: (order) => <StatusBadge status={order.status} /> },
            { key: "qty", header: "Auflage", render: (order) => `${order.requestedQuantity} Stück` },
            { key: "cycle", header: "Nächster Zyklus", render: (order) => formatDate(order.nextCycle) },
            { key: "reorder", header: "Nachbestellung", render: (order) => order.reorderOf ?? "–" },
          ]}
        />
      </Section>

      <Section title={`Bearbeitungsverlauf · ${latestOrder.id}`} subtitle="Der vollständige Bearbeitungsverlauf ist für Besteller transparent sichtbar">
        <Timeline items={latestOrder.timeline} />
      </Section>

      <Section title={`Kommentare · ${latestOrder.id}`} subtitle="Rückfragen und Hinweise zwischen Besteller und Administration">
        <OrderComments comments={latestOrder.comments} />
      </Section>
    </AppShell>
  );
}
