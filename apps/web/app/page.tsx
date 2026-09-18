import Link from "next/link";
import type { DashboardPayload } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataGrid, EmptyState, MetricCard, PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { PollCard } from "@/components/poll-card";
import { apiGet } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireSession();
  const data = await apiGet<DashboardPayload>("/dashboard");

  return (
    <AppShell title="Dashboard" subtitle="Ihre Übersicht über News, Aufgaben, Termine und Services">
      <section className="rounded-3xl bg-gradient-to-r from-brand-900 via-brand-700 to-brand-600 p-6 text-white shadow-card">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-100">Willkommen zurück</p>
        <h2 className="mt-2 text-3xl font-bold">{session.displayName}</h2>
        <p className="mt-2 max-w-3xl text-sm text-brand-50">
          {session.jobTitle} · {session.scopeLabel}
        </p>
        {data.quickLinks.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {data.quickLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="badge bg-white/15 text-white transition hover:bg-white/25"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      {data.metrics.length > 0 ? (
        <DataGrid>
          {data.metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </DataGrid>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {data.news.length > 0 ? (
          <Section
            title="Aktuelles"
            subtitle="Beiträge für Ihre Zielgruppe"
            action={
              <Link href="/aktuelles" className="text-sm font-semibold text-brand-700 hover:underline">
                Alle Beiträge
              </Link>
            }
          >
            <ul className="space-y-3">
              {data.news.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/aktuelles/${item.slug}`}
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:border-brand-100 hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      {!item.read ? <span className="badge bg-brand-50 text-brand-700">neu</span> : null}
                      {item.pinned ? <span className="badge bg-amber-50 text-amber-700">angepinnt</span> : null}
                      <span className="text-xs text-slate-500">
                        {item.publishedAt ? formatDate(item.publishedAt) : "Entwurf"}
                      </span>
                    </div>
                    <p className="mt-2 font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.teaser}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <div className="space-y-6">
          {data.approvals.length > 0 ? (
            <Section
              title="Offene Freigaben"
              subtitle="Warten auf Ihre Entscheidung"
              action={
                <Link href="/freigaben" className="text-sm font-semibold text-brand-700 hover:underline">
                  Zu den Freigaben
                </Link>
              }
            >
              <ul className="space-y-3">
                {data.approvals.map((task) => (
                  <li key={task.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{task.orderNumber}</span>
                      <StatusBadge status={task.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {task.requester} · {task.summary}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {data.notifications.length > 0 ? (
            <Section
              title="Ungelesene Benachrichtigungen"
              subtitle="Ereignisse aus Ihren Modulen"
              action={
                <Link href="/benachrichtigungen" className="text-sm font-semibold text-brand-700 hover:underline">
                  Alle anzeigen
                </Link>
              }
            >
              <ul className="space-y-3">
                {data.notifications.map((entry) => (
                  <li key={entry.id} className="rounded-2xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">{entry.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{entry.detail}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {data.events.length > 0 ? (
          <Section title="Nächste Termine" subtitle="Schulungen, Aktionen und Wartungsfenster">
            <ul className="space-y-3">
              {data.events.map((event) => (
                <li key={event.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{event.title}</span>
                    <span className="badge bg-slate-100 text-slate-600">{event.category}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDateTime(event.startsAt)} · {event.location ?? "ohne Ort"}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <div className="space-y-6">
          {data.cycles.length > 0 ? (
            <Section title="Bestelltermine" subtitle="Stichtage der nächsten Sammelbestellungen">
              <ul className="space-y-3">
                {data.cycles.map((cycle) => (
                  <li key={cycle.id} className="rounded-2xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">{cycle.label}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Nächster Termin: {formatDate(cycle.nextOrderDate)} · {cycle.scope}
                    </p>
                    {cycle.notes ? <p className="mt-1 text-xs text-slate-500">{cycle.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {data.tickets.length > 0 ? (
            <Section title="Meine Serviceanfragen" subtitle="Offene Tickets">
              <ul className="space-y-3">
                {data.tickets.map((ticket) => (
                  <li key={ticket.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {ticket.number} · {ticket.title}
                      </span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {ticket.category} · {ticket.assignee ?? "noch nicht zugewiesen"}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {data.absences.length > 0 ? (
            <Section title="Meine Abwesenheiten" subtitle="Anträge und genehmigte Zeiträume">
              <ul className="space-y-3">
                {data.absences.map((absence) => (
                  <li key={absence.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {formatDate(absence.startDate)} – {formatDate(absence.endDate)}
                      </span>
                      <StatusBadge status={absence.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {absence.type} · {absence.workingDays} Arbeitstage
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      </div>

      {data.polls.length > 0 ? (
        <Section title="Aktuelle Umfrage" subtitle="Ihre Stimme zählt">
          <div className="space-y-4">
            {data.polls.map((poll) => (
              <PollCard key={poll.id} poll={poll} canManage={false} />
            ))}
          </div>
        </Section>
      ) : null}

      {data.metrics.length === 0 && data.news.length === 0 ? (
        <EmptyState
          title="Noch keine Inhalte"
          detail="Sobald Module aktiviert und Inhalte gepflegt sind, erscheinen sie hier."
        />
      ) : null}
    </AppShell>
  );
}
