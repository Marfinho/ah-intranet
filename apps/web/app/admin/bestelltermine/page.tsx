import { orderCycles } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { OrderCycleEditor } from "@/components/order-cycle-editor";
import { Section } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function AdminOrderCyclesPage() {
  return (
    <AppShell title="Admin · Bestelltermine" subtitle="Pflege der nächsten Sammelbestelltermine pro Bestellart">
      <Section title="Bestellzyklen bearbeiten" subtitle="Vorbereitet für spätere standortbezogene Bestelltermine">
        <OrderCycleEditor cycles={orderCycles} />
      </Section>
      <Section title="Aktuelle Terminübersicht" subtitle="Übersicht aller konfigurierten Bestellzyklen">
        <DataTable
          rows={orderCycles}
          columns={[
            { key: "label", header: "Bestellart", render: (cycle) => <span className="font-semibold text-slate-900">{cycle.label}</span> },
            { key: "date", header: "Nächster Termin", render: (cycle) => formatDate(cycle.nextOrderDate) },
            { key: "notes", header: "Hinweis", render: (cycle) => cycle.notes },
            { key: "scope", header: "Scope", render: (cycle) => cycle.scope },
          ]}
        />
      </Section>
    </AppShell>
  );
}
