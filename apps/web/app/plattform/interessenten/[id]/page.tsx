import Link from "next/link";
import {
  LEAD_STATUS_LABELS,
  TIERS,
  formatEuro,
  formatStandortText,
  getModule,
  type HausVorschau,
  type LeadDetail,
} from "@ah-intranet/shared";
import { PlatformShell } from "@/components/platform-shell";
import { InfoList, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { deleteLeadAction, hausAusLeadAction, updateLeadAction, widerrufeLeadLinkAction } from "@/lib/actions";
import { requirePlatformSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { LeadActions } from "../lead-actions";
import { HausForm } from "../haus-form";
import { LeadForm } from "../lead-form";

export default async function InteressentPage({ params }: { params: { id: string } }) {
  await requirePlatformSession();
  const [lead, haus] = await Promise.all([
    apiGet<LeadDetail>(`/leads/${params.id}`),
    apiGet<HausVorschau>(`/leads/${params.id}/haus`),
  ]);
  const heute = lead.angebotHeute;
  const tier = TIERS.find((eintrag) => eintrag.key === lead.konfiguration.tier);

  return (
    <PlatformShell title={lead.name} subtitle={`Interessent · ${LEAD_STATUS_LABELS[lead.status]}`}>
      <Section
        title="Link und Status"
        subtitle={lead.linkWiderrufen ? "Link widerrufen" : `Link gültig bis ${formatDateTime(lead.linkGueltigBis)}`}
      >
        <LeadActions
          id={lead.id}
          status={lead.status}
          widerruf={widerrufeLeadLinkAction.bind(null, lead.id)}
          loeschen={deleteLeadAction.bind(null, lead.id)}
        />
        <p className="mt-3 text-xs text-slate-500">
          Der Link steht nur beim Erzeugen im Klartext zur Verfügung. Gespeichert ist ein Hash. Geht er verloren,
          erzeugen Sie einen neuen.
        </p>
      </Section>

      <Section
        title="Auswahl des Interessenten"
        subtitle={lead.angefragtAm ? `Angefragt am ${formatDateTime(lead.angefragtAm)}` : "Noch keine Anfrage"}
      >
        <InfoList
          items={[
            { label: "Häuser", value: lead.konfiguration.haeuser },
            { label: "Nutzer", value: lead.konfiguration.nutzer },
            { label: "Key-User", value: heute.keyUser },
            { label: "Paket", value: tier ? tier.name : "Eigene Auswahl" },
            {
              label: "Module",
              value: tier
                ? `${tier.module.length} von 22 (Paket)`
                : heute.module
                    .filter((key) => !getModule(key)?.core)
                    .map((key) => getModule(key)?.label ?? key)
                    .join(", ") || "nur Kernmodule",
            },
            { label: "Monatlich (Preisliste heute)", value: formatEuro(heute.monatlich.summeCent) },
            { label: "Einmalig (Preisliste heute)", value: formatEuro(heute.einmalig.summeCent) },
          ]}
        />
        {lead.angebot ? (
          <p className="mt-3 text-sm text-slate-600">
            Bei der Anfrage (Preisliste {lead.preislisteVersion}): {formatEuro(lead.angebot.monatlich.summeCent)} im
            Monat, {formatEuro(lead.angebot.einmalig.summeCent)} einmalig.
          </p>
        ) : null}
      </Section>

      <Section
        title="Haus anlegen"
        subtitle={
          haus.bereitsAngelegt
            ? "Aus diesem Interessenten besteht bereits ein Haus"
            : "Aus den Angaben und der Auswahl des Interessenten"
        }
      >
        {haus.bereitsAngelegt && haus.hausId ? (
          <Link
            href={`/plattform/mandanten/${haus.hausId}`}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            Zum angelegten Haus
          </Link>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Standorte</p>
                <p className="mt-1 text-2xl font-bold">{haus.plan.standorte.length}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {haus.plan.marken.length} Marken, {haus.plan.abteilungen.length} Abteilungen
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Lizenzkontingent</p>
                <p className="mt-1 text-2xl font-bold">{haus.lizenzen}</p>
                <p className="mt-1 text-xs text-slate-500">aktive Konten, Standortlimit unbegrenzt</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Module</p>
                <p className="mt-1 text-2xl font-bold">{haus.modulAn.length} eingeschaltet</p>
                <p className="mt-1 text-xs text-slate-500">
                  {haus.modulErprobung.length > 0
                    ? "Erprobungen gehören zum Paket, bleiben aber aus, bis Sie sie freischalten"
                    : "ohne Erprobungen"}
                </p>
              </div>
            </div>
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 text-sm">
              {haus.plan.standorte.map((standort) => (
                <li key={standort.code} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                  <span className="font-medium text-slate-900">
                    {standort.name} <span className="font-mono text-xs text-slate-500">{standort.code}</span>
                  </span>
                  <span className="text-slate-600">
                    {[...standort.marken, ...standort.abteilungen].join(" · ") || "–"}
                  </span>
                </li>
              ))}
            </ul>
            <HausForm action={hausAusLeadAction.bind(null, lead.id)} kennung={haus.kennung} />
          </div>
        )}
      </Section>

      <Section title="Stammdaten und Häuser" subtitle="Änderungen gelten sofort auch auf der Pitch-Seite">
        <LeadForm
          action={updateLeadAction.bind(null, lead.id)}
          vorgabe={{
            name: lead.name,
            ansprechperson: lead.ansprechperson ?? "",
            notiz: lead.notiz ?? "",
            standorte: formatStandortText(lead.standortListe),
          }}
        />
      </Section>
    </PlatformShell>
  );
}
