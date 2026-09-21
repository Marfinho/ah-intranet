import type { EmployeeDirectoryEntry, ShiftItem, ShiftSwapItem } from "@ah-intranet/shared";
import { SHIFT_SWAP_LABELS } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section, Tag } from "@/components/ui";
import { ShiftComposer } from "./shift-composer";
import { SwapActions, SwapComposer } from "./swap-actions";
import { apiGet } from "@/lib/api";
import { can, requireModule } from "@/lib/session";

interface Organisation {
  locations: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}

function zeit(wert: string): string {
  return new Date(wert).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function tag(wert: string): string {
  return new Date(wert).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export default async function SchichtplanPage({ searchParams }: { searchParams: { mine?: string } }) {
  const session = await requireModule("shifts");
  const darfPflegen = can(session, "shifts.manage");

  const query = new URLSearchParams();
  if (searchParams.mine === "true") query.set("mine", "true");

  const [shifts, swaps, organisation, directory] = await Promise.all([
    apiGet<ShiftItem[]>(`/schichtplan?${query.toString()}`),
    apiGet<ShiftSwapItem[]>("/diensttausch"),
    darfPflegen ? apiGet<Organisation>("/users/organisation") : Promise.resolve({ locations: [], departments: [] }),
    apiGet<{ items: EmployeeDirectoryEntry[] }>("/directory"),
  ]);

  // Nach Tagen gruppieren: eine flache Liste über vier Wochen liest niemand.
  const tage = shifts.reduce<Record<string, ShiftItem[]>>((gruppen, shift) => {
    const schluessel = shift.startsAt.slice(0, 10);
    (gruppen[schluessel] ??= []).push(shift);
    return gruppen;
  }, {});

  const offeneVorgaenge = swaps.filter((swap) => swap.status === "offen" || swap.status === "angenommen");
  const meineSchichten = shifts.filter((shift) => shift.mine && !shift.openSwap);

  return (
    <AppShell title="Schichtplan" subtitle="Besetzung der nächsten vier Wochen, mit Diensttausch">
      {offeneVorgaenge.length > 0 ? (
        <Section
          title={`${offeneVorgaenge.length} laufende Tauschvorgänge`}
          subtitle="Ein Tausch braucht zwei Zustimmungen: die der angefragten Person und die Freigabe"
        >
          <div className="space-y-3">
            {offeneVorgaenge.map((swap) => (
              <div key={swap.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{swap.shift.label}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {tag(swap.shift.startsAt)}, {zeit(swap.shift.startsAt)}–{zeit(swap.shift.endsAt)} Uhr
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {swap.requester} bittet {swap.target} um Übernahme
                      {swap.note ? ` – „${swap.note}“` : ""}
                    </p>
                  </div>
                  <Tag>{SHIFT_SWAP_LABELS[swap.status]}</Tag>
                </div>
                <SwapActions swap={swap} />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {meineSchichten.length > 0 ? (
        <Section title="Dienst abgeben" subtitle="Die angefragte Person muss zustimmen, danach folgt die Freigabe">
          <SwapComposer
            shifts={meineSchichten.map((shift) => ({
              id: shift.id,
              label: `${shift.label} – ${tag(shift.startsAt)}, ${zeit(shift.startsAt)}–${zeit(shift.endsAt)} Uhr`,
            }))}
            people={directory.items
              .filter((person) => person.username !== session.username)
              .map((person) => ({ id: person.id, name: person.displayName }))}
          />
        </Section>
      ) : null}

      {darfPflegen ? (
        <Section title="Schicht anlegen" subtitle="Doppelbelegungen werden beim Speichern abgewiesen">
          <ShiftComposer
            organisation={organisation}
            people={directory.items.map((person) => ({ id: person.id, name: person.displayName }))}
          />
        </Section>
      ) : null}

      <Section
        title={searchParams.mine === "true" ? "Meine Schichten" : "Besetzung"}
        subtitle={`${shifts.length} Schichten in den nächsten vier Wochen`}
        action={
          <a
            href={searchParams.mine === "true" ? "/schichtplan" : "/schichtplan?mine=true"}
            className="ziel rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {searchParams.mine === "true" ? "Alle zeigen" : "Nur meine"}
          </a>
        }
      >
        {shifts.length === 0 ? (
          <EmptyState title="Keine Schichten geplant" detail="Für diesen Zeitraum ist nichts eingetragen." />
        ) : (
          <div className="space-y-5">
            {Object.entries(tage).map(([datum, eintraege]) => (
              <div key={datum}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {tag(eintraege[0].startsAt)}
                </p>
                <div className="mt-2 space-y-2">
                  {eintraege.map((shift) => (
                    <div
                      key={shift.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                        shift.mine ? "border-brand-300 bg-brand-50" : "border-slate-200"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{shift.label}</p>
                        <p className="text-sm text-slate-600">
                          {zeit(shift.startsAt)}–{zeit(shift.endsAt)} Uhr
                          {shift.location ? ` · ${shift.location}` : ""}
                          {shift.department ? ` · ${shift.department}` : ""}
                        </p>
                        {shift.note ? <p className="mt-1 text-sm text-slate-500">{shift.note}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {shift.assignee ? (
                          <Tag>{shift.assignee}</Tag>
                        ) : (
                          <span className="badge bg-amber-100 text-amber-900">Offen</span>
                        )}
                        {shift.openSwap ? (
                          <span className="badge bg-slate-100 text-slate-600">Tausch läuft</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
