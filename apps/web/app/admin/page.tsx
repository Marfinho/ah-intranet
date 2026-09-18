import Link from "next/link";
import type { DashboardMetric, ModuleState } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataGrid, MetricCard, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/session";

const ADMIN_LINKS = [
  { href: "/admin/module", label: "Module", detail: "Fachmodule ein- und ausschalten", adminOnly: true },
  { href: "/admin/benutzer", label: "Benutzer", detail: "Konten anlegen und pflegen", adminOnly: true },
  { href: "/admin/rollen", label: "Rollen & Rechte", detail: "Berechtigungen je Rolle", adminOnly: true },
  { href: "/admin/news", label: "News", detail: "Beiträge verfassen und steuern", adminOnly: false },
  { href: "/admin/dokumente", label: "Dokumente", detail: "Vorlagen und Richtlinien", adminOnly: false },
  { href: "/admin/katalog", label: "Arbeitskleidung", detail: "Artikel und Größen", adminOnly: false },
  { href: "/admin/formulare", label: "Visitenkartenformular", detail: "Felder konfigurieren", adminOnly: false },
  {
    href: "/admin/bestelltermine",
    label: "Bestelltermine",
    detail: "Stichtage der Sammelbestellungen",
    adminOnly: false,
  },
  {
    href: "/admin/schnittstellen",
    label: "Schnittstellen",
    detail: "DMS, Börsen, Buchhaltung, Konzernsysteme",
    adminOnly: true,
  },
  { href: "/admin/audit", label: "Audit-Log", detail: "Protokoll aller Aktionen", adminOnly: true },
  {
    href: "/admin/datenschutz",
    label: "Datenschutz",
    detail: "Auskunft, Löschung, Aufbewahrungsfristen",
    adminOnly: true,
  },
];

/** Nur für die Plattformverwaltung des Betreibers, nicht für Admins im Haus. */
const PLATFORM_LINKS = [
  { href: "/admin/mandanten", label: "Autohäuser", detail: "Mandanten anlegen und freischalten" },
];

export default async function AdminPage() {
  const session = await requireRole("admin", "fachbereichsadmin");

  const [summary, modules] = await Promise.all([
    apiGet<{ metrics: DashboardMetric[] }>("/admin/summary"),
    apiGet<ModuleState[]>("/modules"),
  ]);

  const isAdmin = session.roles.includes("admin");
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

      {session.isPlatformAdmin ? (
        <Section title="Plattformverwaltung" subtitle={`Angemeldet im Haus ${session.tenant.name}`}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {PLATFORM_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-brand-100 bg-brand-50/40 p-5 transition hover:bg-brand-50"
              >
                <p className="font-semibold text-slate-900">{link.label}</p>
                <p className="mt-1 text-sm text-slate-600">{link.detail}</p>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Verwaltungsbereiche" subtitle="Alle Pflegemasken im Überblick">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_LINKS.filter((link) => !link.adminOnly || isAdmin).map((link) => (
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
