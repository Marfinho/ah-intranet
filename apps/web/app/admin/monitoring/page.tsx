import { redirect } from "next/navigation";
import type { PlatformMonitoringPayload } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataGrid, EmptyState, MetricCard, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { MonitoringSettingsForm } from "./settings-form";
import { MeasureButton } from "./measure-button";

export default async function MonitoringAdminPage() {
  const session = await requireSession();
  // Wie bei den Autohäusern selbst: die Last der Maschine geht die
  // Verwaltung eines einzelnen Hauses nichts an.
  if (!session.isPlatformAdmin) {
    redirect("/admin");
  }

  const data = await apiGet<PlatformMonitoringPayload>("/monitoring");

  return (
    <AppShell title="Monitoring" subtitle="Systemlast der Maschine und das Warnsystem per E-Mail">
      <Section
        title="Aktueller Stand"
        subtitle={data.current ? `Gemessen ${formatDateTime(data.current.createdAt)}` : "Noch keine Messung"}
        action={<MeasureButton />}
      >
        {data.current ? (
          <DataGrid>
            <MetricCard
              label="CPU-Last (1 Min.)"
              value={`${data.current.cpuPercent.toFixed(0)} %`}
              helper={`Schwelle ${data.settings.cpuThresholdPercent} %`}
            />
            <MetricCard
              label="Arbeitsspeicher"
              value={`${data.current.memPercent.toFixed(0)} %`}
              helper={`Schwelle ${data.settings.memThresholdPercent} %`}
            />
            <MetricCard
              label="Plattenplatz"
              value={`${data.current.diskPercent.toFixed(0)} %`}
              helper={`Schwelle ${data.settings.diskThresholdPercent} %`}
            />
            <MetricCard
              label="Systemlast (Load, 1 Min.)"
              value={data.current.loadAvg1.toFixed(2)}
              helper="Rohwert des Betriebssystems"
            />
          </DataGrid>
        ) : (
          <EmptyState
            title="Noch keine Messung erfasst"
            detail="Richten Sie den Cron-Lauf aus docs/plattform.md ein, oder lösen Sie oben eine Messung manuell aus."
          />
        )}
      </Section>

      <Section title="Verlauf" subtitle={`${data.history.length} Messpunkt(e) der letzten 30 Tage`}>
        {data.history.length === 0 ? (
          <EmptyState title="Kein Verlauf" detail="Es liegen noch keine gespeicherten Messpunkte vor." />
        ) : (
          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Zeitpunkt</th>
                  <th className="pb-2">CPU</th>
                  <th className="pb-2">RAM</th>
                  <th className="pb-2">Platte</th>
                  <th className="pb-2">Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...data.history].reverse().map((sample) => (
                  <tr key={sample.createdAt}>
                    <td className="py-2 text-slate-600">{formatDateTime(sample.createdAt)}</td>
                    <td className="py-2 text-slate-900">{sample.cpuPercent.toFixed(0)} %</td>
                    <td className="py-2 text-slate-900">{sample.memPercent.toFixed(0)} %</td>
                    <td className="py-2 text-slate-900">{sample.diskPercent.toFixed(0)} %</td>
                    <td className="py-2 text-slate-600">{sample.loadAvg1.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Warnsystem"
        subtitle={
          data.settings.lastAlertAt
            ? `Letzte Warnung: ${formatDateTime(data.settings.lastAlertAt)}`
            : "Bisher keine Warnung verschickt"
        }
      >
        <MonitoringSettingsForm settings={data.settings} />
        <p className="mt-4 text-xs text-slate-500">
          Der Versand braucht SMTP-Zugangsdaten auf dem Server (Umgebungsvariablen{" "}
          <code className="font-mono">SMTP_HOST</code>, <code className="font-mono">SMTP_FROM</code> u. a., siehe{" "}
          <code className="font-mono">docs/plattform.md</code>). Ohne sie wird nur geloggt, nichts verschickt.
        </p>
      </Section>
    </AppShell>
  );
}
