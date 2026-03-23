import { auditLogs } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function AdminAuditPage() {
  return (
    <AppShell title="Admin · Audit-Log" subtitle="Nachvollziehbarkeit für Login, Inhalte, Stammdaten, Freigaben und Statusänderungen">
      <Section title="Audit-Ereignisse" subtitle="Relevante Aktionen werden als einsehbare Grundstruktur protokolliert">
        <DataTable
          rows={auditLogs}
          columns={[
            { key: "created", header: "Zeitpunkt", render: (log) => formatDate(log.createdAt) },
            { key: "actor", header: "Akteur", render: (log) => log.actor },
            { key: "action", header: "Aktion", render: (log) => <span className="font-semibold text-slate-900">{log.action}</span> },
            { key: "entity", header: "Objekt", render: (log) => `${log.entityType} · ${log.entityId}` },
            { key: "detail", header: "Detail", render: (log) => log.detail },
          ]}
        />
      </Section>
    </AppShell>
  );
}
