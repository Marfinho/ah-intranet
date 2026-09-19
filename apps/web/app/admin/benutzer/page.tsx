import { ROLE_LABELS, type EmployeeDirectoryEntry } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section, Tag } from "@/components/ui";
import { UserComposer } from "./user-composer";
import { UserRowActions } from "./user-row-actions";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/session";

interface Organisation {
  locations: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
}

export default async function UsersAdminPage({ searchParams }: { searchParams: { search?: string; status?: string } }) {
  await requireRole("admin");

  const query = new URLSearchParams();
  if (searchParams.search) query.set("search", searchParams.search);
  if (searchParams.status) query.set("status", searchParams.status);

  const [users, organisation] = await Promise.all([
    apiGet<EmployeeDirectoryEntry[]>(`/users?${query.toString()}`),
    apiGet<Organisation>("/users/organisation"),
  ]);

  return (
    <AppShell title="Benutzerverwaltung" subtitle="Konten anlegen, Rollen vergeben und Passwörter zurücksetzen">
      <Section title="Neues Konto" subtitle="Das Startpasswort wird erzeugt und einmalig angezeigt">
        <UserComposer organisation={organisation} />
      </Section>

      <Section title={`${users.length} Konten`} subtitle="Nach Name, Benutzername oder Status filtern">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Name oder Benutzername"
            selects={[
              {
                name: "status",
                label: "Alle Status",
                options: [
                  { value: "active", label: "Aktiv" },
                  { value: "inactive", label: "Deaktiviert" },
                ],
              },
            ]}
          />

          {users.length === 0 ? (
            <EmptyState title="Keine Konten gefunden" detail="Passen Sie die Filter an." />
          ) : (
            <ul className="space-y-3">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{user.displayName}</p>
                      <Tag>{user.username}</Tag>
                      <Tag>{ROLE_LABELS[user.role] ?? user.role}</Tag>
                      {user.status === "inactive" ? (
                        <span className="badge bg-rose-100 text-rose-800">deaktiviert</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {user.jobTitle} · {user.location ?? "ohne Standort"} · {user.department ?? "ohne Abteilung"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{user.email ?? "keine E-Mail hinterlegt"}</p>
                  </div>

                  <UserRowActions userId={user.id} status={user.status} name={user.displayName} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
