"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AVAILABILITY_LABELS, type ConnectorAvailability, type ConnectorState } from "@ah-intranet/shared";
import { checkConnectorAction, runConnectorAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

const AVAILABILITY_STYLES: Record<ConnectorAvailability, string> = {
  public_api: "bg-emerald-100 text-emerald-800",
  documented_format: "bg-sky-100 text-sky-800",
  partner_contract: "bg-amber-100 text-amber-800",
  portal_link: "bg-slate-200 text-slate-700",
};

export function AvailabilityBadge({ availability }: { availability: ConnectorAvailability }) {
  return <span className={cn("badge", AVAILABILITY_STYLES[availability])}>{AVAILABILITY_LABELS[availability]}</span>;
}

/** Verbindungstest und Abgleich direkt aus der Übersicht. */
export function ConnectorActions({ connector }: { connector: ConnectorState }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const runnableCapabilities = connector.capabilities.filter((capability) => capability.implemented);
  const testable = connector.status !== "not_configured" || connector.availability === "portal_link";

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 lg:w-72">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/schnittstellen/${connector.key}`}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Einrichten
        </Link>

        {testable ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await checkConnectorAction(connector.key);
                setFeedback({
                  ok: result.ok,
                  text: result.ok ? (result.detail ?? "In Ordnung") : (result.message ?? "Fehler"),
                });
              })
            }
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Verbindung testen
          </button>
        ) : null}

        {connector.portalUrl && connector.availability === "portal_link" ? (
          <a
            href={connector.portalUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Portal öffnen
          </a>
        ) : null}
      </div>

      {runnableCapabilities.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {runnableCapabilities.map((capability) => (
            <button
              key={capability.key}
              type="button"
              disabled={pending || connector.status !== "configured"}
              title={connector.status !== "configured" ? "Zuerst Zugangsdaten hinterlegen" : capability.description}
              onClick={() =>
                startTransition(async () => {
                  const result = await runConnectorAction(connector.key, capability.key);
                  setFeedback({
                    ok: result.ok,
                    text: result.ok ? (result.detail ?? "Abgleich fertig") : (result.message ?? "Fehler"),
                  });
                })
              }
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "…" : capability.label}
            </button>
          ))}
        </div>
      ) : null}

      {feedback ? (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-xs",
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
          )}
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
