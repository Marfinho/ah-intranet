import type { CalendarEvent } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { ActionButton } from "@/components/forms";
import { EmptyState, Section } from "@/components/ui";
import { EventComposer } from "./event-composer";
import { apiGet } from "@/lib/api";
import { can, requireModule } from "@/lib/session";
import { deleteEventAction } from "@/lib/actions";
import { formatRange } from "@/lib/utils";

const CATEGORY_STYLES: Record<string, string> = {
  schulung: "bg-sky-100 text-sky-800",
  aktion: "bg-amber-100 text-amber-800",
  wartung: "bg-rose-100 text-rose-800",
  meeting: "bg-brand-50 text-brand-700",
  bestellung: "bg-emerald-100 text-emerald-800",
};

export default async function CalendarPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireModule("calendar");

  const query = new URLSearchParams();
  if (searchParams.category) query.set("category", searchParams.category);

  const events = await apiGet<CalendarEvent[]>(`/calendar?${query.toString()}`);
  const canCreate = can(session, "calendar.manage");

  // Nach Monat gruppieren, damit lange Listen lesbar bleiben.
  const byMonth = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(event.startsAt));
    byMonth.set(key, [...(byMonth.get(key) ?? []), event]);
  }

  return (
    <AppShell title="Kalender" subtitle="Schulungen, Aktionen, Wartungsfenster und interne Termine">
      {canCreate ? (
        <Section title="Termin anlegen" subtitle="Sichtbarkeit über Zielgruppen steuern">
          <EventComposer />
        </Section>
      ) : null}

      <Section title={`${events.length} Termine`} subtitle="Die nächsten vier Monate">
        <div className="space-y-4">
          <FilterBar
            showSearch={false}
            selects={[
              {
                name: "category",
                label: "Alle Kategorien",
                options: ["schulung", "aktion", "wartung", "meeting", "bestellung"].map((value) => ({
                  value,
                  label: value,
                })),
              },
            ]}
          />

          {events.length === 0 ? (
            <EmptyState title="Keine Termine" detail="Für diesen Zeitraum ist nichts eingetragen." />
          ) : (
            <div className="space-y-6">
              {[...byMonth.entries()].map(([month, monthEvents]) => (
                <div key={month}>
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{month}</p>
                  <ul className="space-y-3">
                    {monthEvents.map((event) => (
                      <li key={event.id} className="rounded-2xl border border-slate-200 p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`badge ${CATEGORY_STYLES[event.category] ?? "bg-slate-100 text-slate-600"}`}
                              >
                                {event.category}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatRange(event.startsAt, event.endsAt)}
                              </span>
                            </div>
                            <p className="mt-2 font-semibold text-slate-900">{event.title}</p>
                            {event.description ? (
                              <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                            ) : null}
                            <p className="mt-2 text-xs text-slate-500">
                              {event.location ?? "ohne Ort"} · {event.organizer}
                            </p>
                          </div>

                          {canCreate ? (
                            <ActionButton
                              variant="ghost"
                              confirm={`Termin "${event.title}" löschen?`}
                              action={deleteEventAction.bind(null, event.id)}
                            >
                              Löschen
                            </ActionButton>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
