import { MODULE_GROUP_LABELS, type ModuleGroup, type ModuleState } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/forms";
import { Section } from "@/components/ui";
import { ModuleToggle } from "./module-toggle";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { resetModulesAction } from "@/lib/actions";

export default async function ModulesAdminPage() {
  await requireRole("admin");
  const modules = await apiGet<ModuleState[]>("/modules");

  const active = modules.filter((module) => module.enabled).length;
  const groups = (Object.keys(MODULE_GROUP_LABELS) as ModuleGroup[])
    .map((group) => ({
      key: group,
      label: MODULE_GROUP_LABELS[group],
      items: modules.filter((module) => module.group === group),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <AppShell title="Module" subtitle="Fachmodule für das gesamte Intranet aktivieren oder deaktivieren">
      <Section
        title={`${active} von ${modules.length} Modulen aktiv`}
        subtitle="Abgeschaltete Module verschwinden aus der Navigation, und ihre Schnittstellen antworten nicht mehr."
        action={
          <ActionButton
            variant="ghost"
            confirm="Alle Module auf die Standardeinstellung zurücksetzen?"
            action={resetModulesAction}
          >
            Auf Standard zurücksetzen
          </ActionButton>
        }
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Wichtig zu wissen</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Kernmodule wie Dashboard, Benachrichtigungen und Administration lassen sich nicht abschalten.</li>
            <li>
              Module mit Abhängigkeiten werden gemeinsam geschaltet: Wird <em>Bestellungen</em> deaktiviert, gehen die{" "}
              <em>Freigaben</em> automatisch mit.
            </li>
            <li>Daten bleiben erhalten – ein abgeschaltetes Modul ist nur nicht mehr erreichbar.</li>
          </ul>
        </div>
      </Section>

      {groups.map((group) => (
        <Section
          key={group.key}
          title={group.label}
          subtitle={`${group.items.filter((m) => m.enabled).length} von ${group.items.length} aktiv`}
        >
          <ul className="space-y-3">
            {group.items.map((module) => (
              <li key={module.key}>
                <ModuleToggle module={module} allModules={modules} />
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </AppShell>
  );
}
