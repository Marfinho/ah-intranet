import Link from "next/link";
import { redirect } from "next/navigation";
import type { DashboardMetric, ModuleState } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataGrid, MetricCard, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { can, requirePermission } from "@/lib/session";

/** Jede Kachel nennt das Recht, das ihre Seite verlangt - nicht eine Rolle. */
const ADMIN_LINKS = [
  { href: "/admin/module", label: "Module", detail: "Fachmodule ein- und ausschalten", recht: "modules.manage" },
  { href: "/admin/benutzer", label: "Benutzer", detail: "Konten anlegen und pflegen", recht: "users.manage" },
  { href: "/admin/rollen", label: "Rollen & Rechte", detail: "Eigene Rollen anlegen", recht: "roles.manage" },
  {
    href: "/admin/standorte",
    label: "Standorte",
    detail: "Filialen und Autohäuser dieses Mandanten pflegen",
    recht: "organisation.manage",
  },
  { href: "/admin/anmeldung", label: "Anmeldung", detail: "Anmeldearten des Hauses", recht: "auth.manage" },
  {
    href: "/admin/erscheinungsbild",
    label: "Erscheinungsbild",
    detail: "Eigenes Logo statt des AHOI-Zeichens",
    recht: "branding.manage",
  },
  { href: "/admin/news", label: "News", detail: "Beiträge verfassen und steuern", recht: "news.publish" },
  { href: "/admin/dokumente", label: "Dokumente", detail: "Vorlagen und Richtlinien", recht: "documents.manage" },
  { href: "/admin/katalog", label: "Arbeitskleidung", detail: "Artikel und Größen", recht: "catalog.manage" },
  { href: "/admin/formulare", label: "Visitenkartenformular", detail: "Felder konfigurieren", recht: "catalog.manage" },
  {
    href: "/admin/bestelltermine",
    label: "Bestelltermine",
    detail: "Stichtage der Sammelbestellungen",
    recht: "catalog.manage",
  },
  { href: "/admin/audit", label: "Audit-Log", detail: "Protokoll aller Aktionen", recht: "audit.read" },
  {
    href: "/admin/datenschutz",
    label: "Datenschutz",
    detail: "Auskunft, Löschung, Aufbewahrungsfristen",
    recht: "privacy.manage",
  },
];

export default async function AdminPage() {
  const session = await requirePermission("admin.access");
  // Die Plattformverwaltung hat hier nichts verloren: kein Fachmodul, keine
  // Geschäftsdaten, nichts von dem, was diese Seite zeigt betrifft sie. Sie
  // bedient stattdessen einen eigenen Bereich, siehe `/plattform`.
  if (session.isPlatformAdmin) {
    redirect("/plattform");
  }

  const [summary, modules] = await Promise.all([
    apiGet<{ metrics: DashboardMetric[] }>("/admin/summary"),
    apiGet<ModuleState[]>("/modules"),
  ]);

  const isAdmin = can(session, "modules.manage");
  const activeModules = modules.filter((module) => module.enabled).length;
  const disabled = modules.filter((module) => !module.enabled);

  return (
    <AppShell title="Administration" subtitle="Inhalte, Stammdaten, Rechte und Modulsteuerung">
      <DataGrid>
        {summary.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </DataGrid>

      {isAdmin ? (
        <Section
          title="Modulsteuerung"
          subtitle={`${activeModules} von ${modules.length} Modulen aktiv`}
          action={
            <Link
              href="/admin/module"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Module verwalten
            </Link>
          }
        >
          {disabled.length === 0 ? (
            <p className="text-sm text-slate-600">Alle Module sind aktiv.</p>
          ) : (
            <div>
              <p className="text-sm text-slate-600">Derzeit abgeschaltet:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {disabled.map((module) => (
                  <span key={module.key} className="badge bg-rose-100 text-rose-800">
                    {module.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      ) : null}

      <Section title="Verwaltungsbereiche" subtitle="Alle Pflegemasken im Überblick">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_LINKS.filter((link) => can(session, link.recht)).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-slate-200 p-5 transition hover:border-brand-100 hover:bg-slate-50"
            >
              <p className="font-semibold text-slate-900">{link.label}</p>
              <p className="mt-1 text-sm text-slate-600">{link.detail}</p>
            </Link>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}
