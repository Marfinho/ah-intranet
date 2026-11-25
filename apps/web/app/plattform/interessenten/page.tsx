import Link from "next/link";
import { LEAD_STATUS_LABELS, formatEuro, berechneAngebot, type LeadSummary } from "@ah-intranet/shared";
import { PlatformShell } from "@/components/platform-shell";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { createLeadAction } from "@/lib/actions";
import { requirePlatformSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { LeadForm } from "./lead-form";

export default async function InteressentenPage() {
  await requirePlatformSession();
  const leads = await apiGet<LeadSummary[]>("/leads");

  return (
    <PlatformShell title="Interessenten" subtitle="Pitch-Seiten anlegen, versenden und Anfragen verfolgen">
      <Section title={`${leads.length} Interessenten`} subtitle="Bestand">
        {leads.length === 0 ? (
          <EmptyState
            title="Noch kein Interessent"
            detail="Legen Sie unten den ersten an. Daraus entsteht seine Pitch-Seite."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Interessent</th>
                  <th className="pb-2">Häuser</th>
                  <th className="pb-2">Auswahl</th>
                  <th className="pb-2">Link</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => {
                  const angebot = berechneAngebot({ ...lead.konfiguration, tier: lead.konfiguration.tier });
                  return (
                    <tr key={lead.id}>
                      <td className="py-3 font-medium text-slate-900">
                        <Link href={`/plattform/interessenten/${lead.id}`} className="hover:underline">
                          {lead.name}
                        </Link>
                      </td>
                      <td className="py-3 text-slate-600">{lead.standorte}</td>
                      <td className="py-3 text-slate-600">
                        {lead.konfiguration.nutzer} Nutzer · {formatEuro(angebot.monatlich.summeCent)} im Monat
                      </td>
                      <td className="py-3 text-slate-600">
                        {lead.linkWiderrufen ? "widerrufen" : `bis ${formatDateTime(lead.linkGueltigBis)}`}
                      </td>
                      <td className="py-3 text-right">
                        <span className="badge bg-slate-100 text-slate-700">{LEAD_STATUS_LABELS[lead.status]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Neuen Interessenten anlegen"
        subtitle="Mit seinen Häusern. Der Link zur Pitch-Seite erscheint danach einmalig."
      >
        <LeadForm action={createLeadAction} neu />
      </Section>
    </PlatformShell>
  );
}
