import Link from "next/link";
import { adminSnapshot } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataGrid, MetricCard, Section } from "@/components/ui";

const adminLinks = [
  ["/admin/news", "News verwalten"],
  ["/admin/bestellungen", "Bestellungen verwalten"],
  ["/admin/benutzer", "Benutzer verwalten"],
  ["/admin/rollen", "Rollen & Rechte"],
  ["/admin/katalog", "Arbeitskleidungskatalog"],
  ["/admin/formulare", "Visitenkartenformulare"],
  ["/admin/bestelltermine", "Bestelltermine"],
  ["/admin/audit", "Audit-Log"],
] as const;

const metrics = [
  { label: "Benutzer", value: String(adminSnapshot.users.length), helper: "inkl. optionaler E-Mail-Adressen" },
  { label: "Rollen", value: String(adminSnapshot.roles.length), helper: "Global und scope-vorbereitet" },
  { label: "Freigaben", value: String(adminSnapshot.approvalTasks.length), helper: "über alle Bestellarten" },
  { label: "Dokumente", value: String(adminSnapshot.documents.length), helper: "Vorlagen und Pflichtunterlagen" },
  { label: "Tickets", value: String(adminSnapshot.tickets.length), helper: "interne Serviceprozesse" },
  { label: "Onboarding", value: String(adminSnapshot.onboardingTemplates.length), helper: "rollenbasierte Vorlagen" },
  { label: "Verzeichnis", value: String(adminSnapshot.employeeDirectory.length), helper: "Kontakte und Zuständigkeiten" },
  { label: "Audit-Ereignisse", value: String(adminSnapshot.auditLogs.length), helper: "relevante Aktionen nachvollziehbar" },
];

export default function AdminPage() {
  return (
    <AppShell title="Administration" subtitle="Praxisnahe Verwaltungsoberfläche für Inhalte, Kataloge, Freigaben und interne Services">
      <DataGrid>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </DataGrid>
      <Section title="Verwaltungsbereiche" subtitle="Klare Trennung zwischen Inhalten, Konfigurationen, Rollen und operativen Prozessen">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {adminLinks.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-2xl border border-slate-200 p-5 text-sm font-semibold text-slate-800 transition hover:border-brand-100 hover:bg-slate-50">
              {label}
            </Link>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}
