import {
  LEAD_STATUS_LABELS,
  TIERS,
  formatEuro,
  formatStandortText,
  getModule,
  type LeadDetail,
} from "@ah-intranet/shared";
import { PlatformShell } from "@/components/platform-shell";
import { InfoList, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { deleteLeadAction, updateLeadAction, widerrufeLeadLinkAction } from "@/lib/actions";
import { requirePlatformSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { LeadActions } from "../lead-actions";
import { LeadForm } from "../lead-form";

export default async function InteressentPage({ params }: { params: { id: string } }) {
  await requirePlatformSession();
  const lead = await apiGet<LeadDetail>(`/leads/${params.id}`);
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
