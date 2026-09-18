import Link from "next/link";
import { notFound } from "next/navigation";
import { AVAILABILITY_HINTS, type ConnectorState, type SyncRunSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, InfoList, Section } from "@/components/ui";
import { AvailabilityBadge } from "../connector-actions";
import { ConnectorForm } from "./connector-form";
import { ApiError, apiGet } from "@/lib/api";
import { requireModule, requireRole } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export default async function ConnectorDetailPage({ params }: { params: { key: string } }) {
  await requireModule("integrations");
  await requireRole("admin");

  let connector: ConnectorState;
  try {
    connector = await apiGet<ConnectorState>(`/integrations/connectors/${params.key}`);
  } catch (error) {
    if (error instanceof ApiError && error.isMissing) {
      notFound();
    }
    throw error;
  }

  const runs = await apiGet<SyncRunSummary[]>(`/integrations/runs?connector=${params.key}`);

  return (
    <AppShell title={connector.name} subtitle={connector.vendor}>
      <Section
        title="Einordnung"
        subtitle={connector.summary}
        action={
          <Link href="/admin/schnittstellen" className="text-sm font-semibold text-brand-700 hover:underline">
            Zur Übersicht
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <AvailabilityBadge availability={connector.availability} />
          {connector.docsUrl ? (
            <a href={connector.docsUrl} target="_blank" rel="noreferrer" className="badge bg-brand-50 text-brand-700 hover:underline">
              Dokumentation
            </a>
          ) : null}
        </div>

        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          {AVAILABILITY_HINTS[connector.availability]}
        </p>

        <div className="mt-5">
          <p className="text-sm font-semibold text-slate-900">Voraussetzungen für die Inbetriebnahme</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {connector.onboarding.map((step) => (
              <li key={step} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {connector.capabilities.length > 0 ? (
          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-900">Vorgänge</p>
            <ul className="mt-2 space-y-2">
              {connector.capabilities.map((capability) => (
                <li key={capability.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                  <span className="font-medium text-slate-900">{capability.label}</span>
                  <span className="badge bg-slate-100 text-slate-600">
                    {capability.direction === "inbound" ? "eingehend" : "ausgehend"}
                  </span>
                  {capability.implemented ? (
                    <span className="badge bg-emerald-100 text-emerald-800">umgesetzt</span>
                  ) : (
                    <span className="badge bg-amber-100 text-amber-800">wartet auf Spezifikation</span>
                  )}
                  <span className="w-full text-slate-600">{capability.description}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section
        title="Konfiguration"
        subtitle={
          connector.availability === "partner_contract"
            ? "Felder sind vorbereitet – tragen Sie die Werte ein, sobald der Vertrag steht."
            : "Zugangsdaten werden verschlüsselt gespeichert und nie zurückgelesen."
        }
      >
        <ConnectorForm connector={connector} />
      </Section>

      {connector.lastCheckAt ? (
        <Section title="Letzter Verbindungstest" subtitle={formatDateTime(connector.lastCheckAt)}>
          <InfoList
            items={[
              { label: "Ergebnis", value: connector.lastCheckOk ? "erfolgreich" : "fehlgeschlagen" },
              { label: "Meldung", value: connector.lastCheckMessage ?? "–" },
              { label: "Zuletzt geändert von", value: connector.updatedBy ?? "–" },
            ]}
          />
        </Section>
      ) : null}

      <Section title="Laufprotokoll" subtitle="Abgleiche dieser Schnittstelle">
        {runs.length === 0 ? (
          <EmptyState title="Noch keine Läufe" detail="Hier erscheinen alle Abgleiche dieser Schnittstelle." />
        ) : (
          <ul className="space-y-3">
            {runs.map((run) => (
              <li key={run.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{run.capability}</span>
                  <span
                    className={`badge ${run.status === "succeeded" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
                  >
                    {run.status === "succeeded" ? "erfolgreich" : "fehlgeschlagen"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{run.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDateTime(run.startedAt)}
                  {run.durationMs !== null && run.durationMs !== undefined ? ` · ${run.durationMs} ms` : ""}
                  {run.triggeredBy ? ` · ausgelöst von ${run.triggeredBy}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
