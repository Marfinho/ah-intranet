import { redirect } from "next/navigation";
import type { TenantSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { TenantComposer } from "./tenant-composer";
import { TenantLogoUpload } from "./tenant-logo-upload";
import { TenantRowActions } from "./tenant-row-actions";

export default async function TenantsAdminPage() {
  const session = await requireSession();
  // Die Rolle `admin` gilt im eigenen Haus. Häuser anzulegen ist Sache des
  // Betreibers - und darf im Haus nicht vergeben werden können.
  if (!session.isPlatformAdmin) {
    redirect("/admin");
  }

  const tenants = await apiGet<TenantSummary[]>("/tenants");
  const aktiv = tenants.filter((tenant) => tenant.isActive).length;

  return (
    <AppShell title="Autohäuser" subtitle="Mandanten der Plattform anlegen, freischalten und sperren">
      <Section title={`${aktiv} von ${tenants.length} Häusern freigeschaltet`} subtitle="Bestand">
        {tenants.length === 0 ? (
          <EmptyState title="Noch kein Haus angelegt" detail="Legen Sie unten das erste Autohaus an." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Logo</th>
                  <th className="pb-2">Haus</th>
                  <th className="pb-2">Kennung</th>
                  <th className="pb-2">Adresse</th>
                  <th className="pb-2">Konten</th>
                  <th className="pb-2">Angelegt</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="py-3">
                      <TenantLogoUpload tenant={tenant} />
                    </td>
                    <td className="py-3 font-medium text-slate-900">
                      {tenant.name}
                      {tenant.notes ? <p className="text-xs font-normal text-slate-500">{tenant.notes}</p> : null}
                    </td>
                    <td className="py-3 font-mono text-xs text-slate-600">{tenant.slug}</td>
                    <td className="py-3 text-slate-600">{tenant.domain ?? "–"}</td>
                    <td className="py-3 text-slate-600">{tenant.userCount}</td>
                    <td className="py-3 text-slate-600">{formatDateTime(tenant.createdAt)}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-3">
                        {tenant.isActive ? (
                          <span className="badge bg-emerald-100 text-emerald-800">aktiv</span>
                        ) : (
                          <span className="badge bg-rose-100 text-rose-800">gesperrt</span>
                        )}
                        <TenantRowActions tenant={tenant} self={tenant.slug === session.tenant.slug} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Neues Haus einrichten"
        subtitle="Mandant, Rollen und erstes Administrationskonto in einem Schritt"
      >
        <TenantComposer />
      </Section>
    </AppShell>
  );
}
