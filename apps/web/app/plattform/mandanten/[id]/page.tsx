import type { ModuleState, TenantStats } from "@ah-intranet/shared";
import { PlatformShell } from "@/components/platform-shell";
import { DataGrid, MetricCard, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { setTenantLicenseAction, setTenantLocationLimitAction } from "@/lib/actions";
import { formatDateTime } from "@/lib/utils";
import { QuotaEditor } from "./quota-editor";
import { TenantModuleToggle } from "./tenant-module-toggle";

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const [stats, modules] = await Promise.all([
    apiGet<TenantStats>(`/tenants/${params.id}/kennzahlen`),
    apiGet<ModuleState[]>(`/tenants/${params.id}/module`),
  ]);

  const lizenzauslastung =
    stats.licensedSeats !== null ? `${stats.activeUsers} von ${stats.licensedSeats} Lizenzen` : "unbegrenzt";
  const standortauslastung =
    stats.locationLimit !== null ? `${stats.locations} von ${stats.locationLimit} Standorten` : "unbegrenzt";
  const erprobungsmodule = modules.filter((module) => module.stage === "beta");
  const uebrigeModule = modules.filter((module) => module.stage !== "beta" && !module.core);

  return (
    <PlatformShell title={stats.name} subtitle={`Kennzahlen und Modulsteuerung · ${stats.slug}`}>
      <Section
        title="Lizenz"
        subtitle={lizenzauslastung}
        action={
          <QuotaEditor
            label="Lizenzkontingent ändern"
            promptText="Lizenzkontingent (Höchstzahl aktiver Konten) - leer lassen für unbegrenzt:"
            value={stats.licensedSeats}
            action={setTenantLicenseAction.bind(null, stats.id)}
          />
        }
      >
        <p className="text-sm text-slate-600">
          {stats.licensedSeats !== null && stats.activeUsers >= stats.licensedSeats
            ? "Das Kontingent ist ausgeschöpft - ein weiteres aktives Konto lässt sich erst nach Erweiterung anlegen."
            : "Keine Angabe erforderlich, solange das Haus ohne Lizenzmodell läuft."}
        </p>
      </Section>

      <Section
        title="Standorte"
        subtitle={standortauslastung}
        action={
          <QuotaEditor
            label="Standortlimit ändern"
            promptText="Standortlimit (Höchstzahl Filialen) - leer lassen für unbegrenzt:"
            value={stats.locationLimit}
            action={setTenantLocationLimitAction.bind(null, stats.id)}
          />
        }
      >
        <p className="text-sm text-slate-600">
          {stats.locationLimit !== null && stats.locations >= stats.locationLimit
            ? "Das Limit ist ausgeschöpft - ein weiterer Standort lässt sich erst nach Erweiterung anlegen."
            : "Keine Angabe erforderlich, solange das Haus ohne Standortlimit läuft."}
        </p>
      </Section>

      <Section title="Kennzahlen" subtitle="Zählwerte ohne Personenbezug - keine Inhalte, keine Namen">
        <DataGrid>
          <MetricCard label="Aktive Konten" value={String(stats.activeUsers)} helper={lizenzauslastung} />
          <MetricCard label="Konten insgesamt" value={String(stats.totalUsers)} helper="inklusive deaktivierter" />
          <MetricCard label="Standorte" value={String(stats.locations)} helper={standortauslastung} />
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
    </PlatformShell>
  );
}
