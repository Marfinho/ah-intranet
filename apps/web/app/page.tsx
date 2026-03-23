import Link from "next/link";
import { criticalNews, currentUser, dashboardMetrics, openTickets, orderCycles, pendingApprovals, unreadNotifications } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataGrid, MetricCard, PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const quickLinks = [
  ["/mitarbeiter", "Mitarbeiterverzeichnis"],
  ["/dokumente", "Dokumente & Vorlagen"],
  ["/benachrichtigungen", "Benachrichtigungen"],
  ["/kalender", "Kalender"],
  ["/tickets", "Serviceanfragen"],
  ["/onboarding", "Onboarding"],
] as const;

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard" subtitle="Zentrale Übersicht für News, Bestellungen, Freigaben und interne Services">
      <section className="rounded-3xl bg-gradient-to-r from-brand-900 via-brand-700 to-brand-600 p-6 text-white shadow-card">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-100">Willkommen zurück</p>
        <h2 className="mt-2 text-3xl font-bold">{currentUser.displayName}</h2>
        <p className="mt-2 max-w-3xl text-sm text-brand-50">
          Das Intranet bündelt interne News, Mitarbeiterverzeichnis, Dokumente, Bestellungen, Freigaben, Serviceanfragen und Onboarding in einer modular erweiterbaren Oberfläche.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <span className="badge bg-white/15 text-white">Benutzername: {currentUser.username}</span>
          <span className="badge bg-white/15 text-white">Rolle: {currentUser.role}</span>
          <span className="badge bg-white/15 text-white">Scope: {currentUser.scope}</span>
          <span className="badge bg-white/15 text-white">Ungelesen: {unreadNotifications.length}</span>
        </div>
      </section>

      <DataGrid>
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </DataGrid>

      <Section title="Schnellzugriffe" subtitle="Zentrale Intranet-Bausteine für den täglichen Arbeitsablauf">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-2xl border border-slate-200 p-5 font-semibold text-slate-900 transition hover:border-brand-100 hover:bg-slate-50">
              {label}
            </Link>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Section title="Priorisierte Meldungen" subtitle="Wichtige Informationen aus allen Standorten und Fachbereichen" action={<Link href="/aktuelles" className="text-sm font-semibold text-brand-700">Alle Meldungen</Link>}>
          <div className="space-y-4">
            {criticalNews.map((news) => (
              <Link key={news.id} href={`/aktuelles/${news.slug}`} className="block rounded-2xl border border-slate-200 p-4 transition hover:border-brand-100 hover:bg-slate-50">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={news.status} />
                  <PriorityBadge priority={news.priority} />
                  <span className="text-sm text-slate-500">{formatDate(news.publishedAt)}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{news.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{news.teaser}</p>
                <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Zielgruppen: {news.audience.join(", ")}</p>
              </Link>
            ))}
          </div>
        </Section>

        <Section title="Nächste Schritte" subtitle="Bestelltermine, offene Tickets und Handlungsbedarf">
          <div className="space-y-4">
            {orderCycles.map((cycle) => (
              <div key={cycle.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{cycle.label}</p>
                    <p className="text-sm text-slate-600">{cycle.notes}</p>
                  </div>
                  <span className="badge bg-brand-50 text-brand-700">{formatDate(cycle.nextOrderDate)}</span>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">Offene Serviceanfragen</p>
              <div className="mt-3 space-y-2">
                {openTickets.slice(0, 3).map((ticket) => (
                  <div key={ticket.id} className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">{ticket.title}</span> · {ticket.status}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Freigaben mit Handlungsbedarf" subtitle="Offene Prüfungen und Sammelbestellungen für Admins und Fachbereichsadmins">
        <div className="grid gap-4 lg:grid-cols-3">
          {pendingApprovals.map((task) => (
            <div key={task.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{task.orderId}</p>
                <StatusBadge status={task.status} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{task.requester} · {task.scope}</p>
              <p className="mt-3 text-sm text-slate-700">{task.nextAction}</p>
            </div>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}
