import Link from "next/link";
import {
  AVAILABILITY_HINTS,
  AVAILABILITY_LABELS,
  CONNECTOR_CATEGORY_LABELS,
  type ConnectorCategory,
  type ConnectorState,
  type SyncRunSummary,
} from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataGrid, EmptyState, MetricCard, Section } from "@/components/ui";
import { AvailabilityBadge, ConnectorActions } from "./connector-actions";
import { apiGet } from "@/lib/api";
import { requireModule, requireRole } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export default async function ConnectorsPage() {
  await requireModule("integrations");
  await requireRole("admin");

  const [connectors, runs] = await Promise.all([
    apiGet<ConnectorState[]>("/integrations/connectors"),
    apiGet<SyncRunSummary[]>("/integrations/runs"),
  ]);

  const ready = connectors.filter((entry) => entry.availability === "public_api" || entry.availability === "documented_format");
  const gated = connectors.filter((entry) => entry.availability === "partner_contract");
  const configured = connectors.filter((entry) => entry.status === "configured");

  const categories = (Object.keys(CONNECTOR_CATEGORY_LABELS) as ConnectorCategory[])
    .map((category) => ({
      key: category,
      label: CONNECTOR_CATEGORY_LABELS[category],
      items: connectors.filter((entry) => entry.category === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <AppShell title="Schnittstellen" subtitle="Anbindung an Konzernsysteme, DMS, Börsen, Bewertung und Buchhaltung">
      <DataGrid>
        <MetricCard label="Konnektoren" value={String(connectors.length)} helper="in der Registry hinterlegt" />
        <MetricCard label="Einsatzbereit" value={String(ready.length)} helper="offene Spezifikation, umgesetzt" />
        <MetricCard label="Konfiguriert" value={String(configured.length)} helper="Zugangsdaten vollständig" />
        <MetricCard label="Vertrag nötig" value={String(gated.length)} helper="Spezifikation nicht öffentlich" />
      </DataGrid>

      <Section title="Wie diese Übersicht zu lesen ist" subtitle="Nicht jede Schnittstelle lässt sich ohne Weiteres anbinden">
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Im Umfeld der Konzernmarken sind die meisten Schnittstellen vertraglich geschützt: Hersteller und Anbieter
            geben die Spezifikation nur an zertifizierte Softwarepartner heraus, üblicherweise über den DMS-Anbieter.
            Diese Übersicht benennt für jeden Konnektor, woran Sie sind.
          </p>
          <ul className="space-y-2">
            {(["public_api", "documented_format", "partner_contract", "portal_link"] as const).map((availability) => (
              <li key={availability} className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-start">
                <span className="shrink-0">
                  <AvailabilityBadge availability={availability} />
                </span>
                <span className="text-sm text-slate-600">{AVAILABILITY_HINTS[availability]}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {categories.map((group) => (
        <Section
          key={group.key}
          title={group.label}
          subtitle={`${group.items.filter((entry) => entry.status === "configured").length} von ${group.items.length} konfiguriert`}
        >
          <ul className="space-y-3">
            {group.items.map((connector) => (
              <li key={connector.key} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/schnittstellen/${connector.key}`}
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        {connector.name}
                      </Link>
                      <AvailabilityBadge availability={connector.availability} />
                      {connector.status === "configured" ? (
                        <span className="badge bg-emerald-100 text-emerald-800">konfiguriert</span>
                      ) : connector.status === "disabled" ? (
                        <span className="badge bg-slate-200 text-slate-700">deaktiviert</span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs text-slate-500">{connector.vendor}</p>
                    <p className="mt-2 text-sm text-slate-600">{connector.summary}</p>

                    {connector.lastCheckAt ? (
                      <p className={`mt-2 text-xs ${connector.lastCheckOk ? "text-emerald-700" : "text-rose-700"}`}>
                        Letzter Test {formatDateTime(connector.lastCheckAt)}: {connector.lastCheckMessage}
                      </p>
                    ) : null}

                    {connector.lastRun ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Letzter Abgleich {formatDateTime(connector.lastRun.startedAt)} –{" "}
                        {connector.lastRun.status === "succeeded" ? "erfolgreich" : "fehlgeschlagen"}:{" "}
                        {connector.lastRun.message}
                      </p>
                    ) : null}
                  </div>

                  <ConnectorActions connector={connector} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section title="Laufprotokoll" subtitle="Die letzten Abgleiche, auch die fehlgeschlagenen">
        {runs.length === 0 ? (
          <EmptyState title="Noch keine Läufe" detail="Sobald ein Abgleich läuft, wird er hier protokolliert." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Zeitpunkt</th>
                  <th className="px-4 py-3 font-semibold">Schnittstelle</th>
                  <th className="px-4 py-3 font-semibold">Vorgang</th>
                  <th className="px-4 py-3 font-semibold">Ergebnis</th>
                  <th className="px-4 py-3 font-semibold">Meldung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(run.startedAt)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{run.connectorName}</td>
                    <td className="px-4 py-3 text-slate-600">{run.capability}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          run.status === "succeeded"
                            ? "bg-emerald-100 text-emerald-800"
                            : run.status === "failed"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {run.status === "succeeded" ? "erfolgreich" : run.status === "failed" ? "fehlgeschlagen" : "läuft"}
                      </span>
                      {run.itemsProcessed > 0 ? (
                        <span className="ml-2 text-xs text-slate-500">{run.itemsProcessed} Datensätze</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{run.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </AppShell>
  );
}
