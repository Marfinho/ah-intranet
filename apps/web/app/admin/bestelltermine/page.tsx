import type { OrderCycleInfo } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/forms";
import { EmptyState, Section } from "@/components/ui";
import { CycleForm } from "./cycle-form";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { deleteCycleAction } from "@/lib/actions";
import { formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  business_cards: "Visitenkarten",
  workwear: "Arbeitskleidung",
};

export default async function CyclesAdminPage() {
  const session = await requireRole("admin", "fachbereichsadmin");
  const cycles = await apiGet<OrderCycleInfo[]>("/orders/cycles");

  return (
    <AppShell title="Bestelltermine" subtitle="Stichtage der externen Sammelbestellungen">
      <Section title="Termin anlegen oder ändern" subtitle="Der nächste Termin in der Zukunft wird Bestellungen zugeordnet">
        <CycleForm />
      </Section>

      <Section title={`${cycles.length} Termine`} subtitle="Aufsteigend nach Datum">
        {cycles.length === 0 ? (
          <EmptyState title="Keine Termine" detail="Ohne Termin werden Bestellungen keinem Zyklus zugeordnet." />
        ) : (
          <ul className="space-y-3">
            {cycles.map((cycle) => (
              <li
                key={cycle.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-5 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge bg-brand-50 text-brand-700">{TYPE_LABELS[cycle.type] ?? cycle.type}</span>
                    <span className="font-semibold text-slate-900">{cycle.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDate(cycle.nextOrderDate)} · {cycle.scope}
                  </p>
                  {cycle.notes ? <p className="mt-1 text-xs text-slate-500">{cycle.notes}</p> : null}
                  <p className="mt-2 font-mono text-xs text-slate-400">{cycle.id}</p>
                </div>

                {session.roles.includes("admin") ? (
                  <ActionButton
                    variant="ghost"
                    confirm={`Termin "${cycle.label}" löschen?`}
                    action={deleteCycleAction.bind(null, cycle.id)}
                  >
                    Löschen
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
