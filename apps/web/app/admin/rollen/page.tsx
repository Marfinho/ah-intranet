import type { PermissionSummary, RoleSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui";
import { RolePermissionEditor } from "./role-permission-editor";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/session";

export default async function RolesAdminPage() {
  await requireRole("admin");

  const [roles, permissions] = await Promise.all([
    apiGet<RoleSummary[]>("/roles"),
    apiGet<PermissionSummary[]>("/roles/permissions"),
  ]);

  return (
    <AppShell title="Rollen & Rechte" subtitle="Welche Rolle darf was im Intranet">
      <Section title={`${roles.length} Rollen`} subtitle="Änderungen wirken sofort für alle Personen mit dieser Rolle">
        <div className="space-y-4">
          {roles.map((role) => (
            <RolePermissionEditor key={role.id} role={role} permissions={permissions} />
          ))}
        </div>
      </Section>

      <Section title="Verfügbare Berechtigungen" subtitle="Feingranulare Rechte, die Rollen zugeordnet werden">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Schlüssel</th>
                <th className="px-4 py-3 font-semibold">Bezeichnung</th>
                <th className="px-4 py-3 font-semibold">Beschreibung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {permissions.map((permission) => (
                <tr key={permission.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{permission.key}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{permission.name}</td>
                  <td className="px-4 py-3 text-slate-600">{permission.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </AppShell>
  );
}
