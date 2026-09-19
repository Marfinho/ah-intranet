import type { PermissionSummary, RoleSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui";
import { RoleComposer } from "./role-composer";
import { RolePermissionEditor } from "./role-permission-editor";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";

export default async function RolesAdminPage() {
  await requirePermission("roles.manage");

  const [roles, permissions] = await Promise.all([
    apiGet<RoleSummary[]>("/roles"),
    apiGet<PermissionSummary[]>("/roles/permissions"),
  ]);

  // Reihenfolge der Bereiche folgt der Registry, nicht dem Alphabet.
  const bereiche = permissions.reduce<string[]>((liste, permission) => {
    if (!liste.includes(permission.bereich)) {
      liste.push(permission.bereich);
    }
    return liste;
  }, []);

  return (
    <AppShell title="Rollen & Rechte" subtitle="Welche Rolle darf was im Intranet">
      <Section
        title={`${roles.length} Rollen`}
        subtitle="Änderungen wirken sofort: Wer ein Recht verliert, wird abgemeldet und muss sich neu anmelden"
      >
        <div className="space-y-4">
          {roles.map((role) => (
            <RolePermissionEditor key={role.id} role={role} permissions={permissions} bereiche={bereiche} />
          ))}
        </div>
      </Section>

      <Section
        title="Eigene Rolle anlegen"
        subtitle="Name vergeben, Rechte anklicken – die Rolle steht danach in der Benutzerverwaltung zur Auswahl"
      >
        <RoleComposer permissions={permissions} bereiche={bereiche} />
      </Section>

      <Section
        title={`${permissions.length} Berechtigungen`}
        subtitle="Jede entspricht einer Prüfung im Code – neue entstehen mit neuen Funktionen, nicht auf Zuruf"
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Bereich</th>
                <th className="px-4 py-3 font-semibold">Bezeichnung</th>
                <th className="px-4 py-3 font-semibold">Beschreibung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {permissions.map((permission) => (
                <tr key={permission.id}>
                  <td className="px-4 py-3 text-slate-600">{permission.bereich}</td>
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
