import { PlatformShell } from "@/components/platform-shell";
import { Section } from "@/components/ui";
import { apiGet } from "@/lib/api";

interface HealthReport {
  ok: boolean;
  service: string;
  uptimeSeconds: number;
  checks: {
    database: { ok: boolean; latencyMs?: number; message?: string };
    secrets: { ok: boolean; message?: string };
  };
}

function formatUptime(seconds: number): string {
  const stunden = Math.floor(seconds / 3600);
  const minuten = Math.floor((seconds % 3600) / 60);
  return stunden > 0 ? `${stunden} Std. ${minuten} Min.` : `${minuten} Min.`;
}

export default async function StatusPage() {
  const health = await apiGet<HealthReport>("/health");

  return (
    <PlatformShell
      title="Systemstatus"
      subtitle="Zustand der Anwendung selbst - für die Auslastung des Servers siehe das Unraid-Dashboard oder Netdata"
    >
      <Section
        title={health.ok ? "Alles in Ordnung" : "Störung"}
        subtitle={`${health.service} · läuft seit ${formatUptime(health.uptimeSeconds)}`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">Datenbankverbindung</p>
              <span className={`badge ${health.checks.database.ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                {health.checks.database.ok ? "ok" : "gestört"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {health.checks.database.ok
                ? `Antwortzeit ${health.checks.database.latencyMs} ms`
                : (health.checks.database.message ?? "Nicht erreichbar")}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">Schlüssel gesetzt</p>
              <span className={`badge ${health.checks.secrets.ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                {health.checks.secrets.ok ? "ok" : "fehlt"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{health.checks.secrets.message ?? "JWT_SECRET, DATABASE_URL"}</p>
          </div>
        </div>
      </Section>

      <Section title="Server-Auslastung" subtitle="Bewusst nicht hier nachgebaut">
        <p className="text-sm text-slate-600">
          CPU, Arbeitsspeicher und Plattenplatz des Servers gehören nicht in diese Anwendung - ein Docker-Container
          sieht ohnehin nicht die echten Host-Werte. Für den laufenden Betrieb: das Unraid-Dashboard (Verlauf der
          letzten Stunden) oder, für Historie und Warnschwellen, eine dedizierte App wie Netdata.
        </p>
      </Section>
    </PlatformShell>
  );
}
