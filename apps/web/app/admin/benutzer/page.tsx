import { users } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/ui";

export default function AdminUsersPage() {
  return (
    <AppShell title="Admin · Benutzer" subtitle="Benutzerverwaltung mit vorbereiteter Standort-, Abteilungs- und Scope-Logik">
      <Section title="Benutzer" subtitle="Login per Benutzername + Passwort, E-Mail optional">
        <DataTable
          rows={users}
          columns={[
            { key: "username", header: "Benutzername", render: (user) => <span className="font-semibold text-slate-900">{user.username}</span> },
            { key: "name", header: "Name", render: (user) => user.displayName },
            { key: "role", header: "Rolle", render: (user) => user.role },
            { key: "scope", header: "Scope", render: (user) => user.scope },
            { key: "email", header: "E-Mail", render: (user) => user.email ?? "Keine Firmen-E-Mail" },
          ]}
        />
      </Section>
    </AppShell>
  );
}
