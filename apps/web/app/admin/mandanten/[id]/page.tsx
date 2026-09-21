import { redirect } from "next/navigation";
import type { ModuleState, TenantStats } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataGrid, MetricCard, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { TenantLicenseEditor } from "./tenant-license-editor";
import { TenantModuleToggle } from "./tenant-module-toggle";

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.isPlatformAdmin) {
    redirect("/admin");
  }

  const [stats, modules] = await Promise.all([
    apiGet<TenantStats>(`/tenants/${params.id}/kennzahlen`),
    apiGet<ModuleState[]>(`/tenants/${params.id}/module`),
  ]);

  const auslastung =
    stats.licensedSeats !== null ? `${stats.activeUsers} von ${stats.licensedSeats} Lizenzen` : "unbegrenzt";
  const erprobungsmodule = modules.filter((module) => module.stage === "beta");
  const uebrigeModule = modules.filter((module) => module.stage !== "beta" && !module.core);

  return (
    <AppShell title={stats.name} subtitle={`Kennzahlen und Modulsteuerung · ${stats.slug}`}>
      <Section
        title="Lizenz"
        subtitle={auslastung}
        action={<TenantLicenseEditor tenantId={stats.id} licensedSeats={stats.licensedSeats} />}
      >
        <p className="text-sm text-slate-600">
          {stats.licensedSeats !== null && stats.activeUsers >= stats.licensedSeats
            ? "Das Kontingent ist ausgeschöpft - ein weiteres aktives Konto lässt sich erst nach Erweiterung anlegen."
            : "Keine Angabe erforderlich, solange das Haus ohne Lizenzmodell läuft."}
        </p>
      </Section>

      <Section title="Kennzahlen" subtitle="Zählwerte ohne Personenbezug - keine Inhalte, keine Namen">
        <DataGrid>
          <MetricCard label="Aktive Konten" value={String(stats.activeUsers)} helper={auslastung} />
          <MetricCard label="Konten insgesamt" value={String(stats.totalUsers)} helper="inklusive deaktivierter" />
          <MetricCard label="Bestellungen" value={String(stats.orders)} helper="Visitenkarten und Arbeitskleidung" />
          <MetricCard label="Serviceanfragen" value={String(stats.tickets)} helper="alle Kategorien" />
          <MetricCard label="Aushänge" value={String(stats.news)} helper="veröffentlicht und Entwürfe" />
          <MetricCard
            label="Letzte Aktivität"
            value={stats.lastActivityAt ? formatDateTime(stats.lastActivityAt) : "keine"}
            helper="jüngster Audit-Eintrag"
          />
        </DataGrid>
      </Section>

      <Section
        title="Erprobungsmodule"
        subtitle="Nur die Plattformverwaltung darf sie einschalten - das Haus jederzeit wieder abschalten"
      >
        {erprobungsmodule.length === 0 ? (
          <p className="text-sm text-slate-600">Keine Erprobungsmodule in der Registry.</p>
        ) : (
          <ul className="space-y-3">
            {erprobungsmodule.map((module) => (
              <li key={module.key}>
                <TenantModuleToggle tenantId={stats.id} module={module} allModules={modules} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Übrige Module" subtitle="Stabile Fachmodule dieses Hauses">
        <ul className="space-y-3">
          {uebrigeModule.map((module) => (
            <li key={module.key}>
              <TenantModuleToggle tenantId={stats.id} module={module} allModules={modules} />
            </li>
          ))}
        </ul>
      </Section>
    </AppShell>
  );
}
