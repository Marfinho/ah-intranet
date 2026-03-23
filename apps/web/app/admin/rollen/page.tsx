import { roles } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui";

export default function AdminRolesPage() {
  return (
    <AppShell title="Admin · Rollen & Rechte" subtitle="Serverseitig robust prüfbare, erweiterbare Rollen- und Scope-Struktur">
      <Section title="Rollenmodell" subtitle="Vorbereitet für globale und zukünftige scope-basierte Rechte">
        <div className="grid gap-4 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.key} className="rounded-2xl border border-slate-200 p-5">
              <p className="text-lg font-semibold text-slate-900">{role.name}</p>
              <p className="mt-2 text-sm text-slate-600">{role.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {role.permissions.map((permission) => (
                  <li key={permission}>• {permission}</li>
                ))}
              </ul>
              <p className="mt-4 text-xs uppercase tracking-wide text-slate-400">Scope vorbereitet: {role.scopePrepared ? "Ja" : "Nein"}</p>
            </div>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}
