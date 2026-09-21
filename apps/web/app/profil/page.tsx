import { AppShell } from "@/components/app-shell";
import { InfoList, Section, Tag } from "@/components/ui";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { requireSession } from "@/lib/session";
import { apiGetSafe } from "@/lib/api";
import type { EmployeeDirectoryEntry } from "@ah-intranet/shared";

export default async function ProfilePage() {
  const session = await requireSession();

  // Kontaktdaten stehen im Verzeichnis, nicht im Token.
  const directory = await apiGetSafe<{ items: EmployeeDirectoryEntry[] }>(
    `/directory?search=${encodeURIComponent(session.displayName)}`,
    { items: [] },
  );
  const me = directory.items.find((entry) => entry.username === session.username);

  return (
    <AppShell title="Mein Profil" subtitle="Kontaktdaten, Zuständigkeiten und Zugangsdaten">
      <Section title="Stammdaten" subtitle="Von der Administration gepflegt">
        <InfoList
          items={[
            { label: "Name", value: session.displayName },
            { label: "Benutzername", value: session.username },
            { label: "Funktion", value: session.jobTitle ?? "–" },
            { label: "E-Mail", value: session.email ?? "–" },
            { label: "Standort", value: session.location ?? "–" },
            { label: "Abteilung", value: session.department ?? "–" },
            { label: "Fachbereich", value: session.specialtyArea ?? "–" },
            {
              label: "Rollen",
              value: (
                <span className="flex flex-wrap gap-2">
                  {session.roleLabels.map((label) => (
                    <Tag key={label}>{label}</Tag>
                  ))}
                </span>
              ),
            },
          ]}
        />

        {session.permissions.length > 0 ? (
          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-900">Ihre Berechtigungen</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {session.permissions.map((permission) => (
                <Tag key={permission}>{permission}</Tag>
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Kontaktdaten pflegen" subtitle="Diese Angaben erscheinen im Mitarbeiterverzeichnis">
        <ProfileForm
          defaults={{
            phone: me?.phone ?? "",
            mobile: me?.mobile ?? "",
            presence: me?.presence ?? "vor Ort",
            responsibilities: (me?.responsibilities ?? []).join(", "),
          }}
          mobileInDirectory={me?.mobileInDirectory ?? true}
        />
      </Section>

      <Section title="Meine Daten" subtitle="Auskunft nach Art. 15 DSGVO – alles, was das Intranet über Sie hält">
        <p className="text-sm text-slate-600">
          Die Datei enthält Ihre Stammdaten und alle Vorgänge, die Ihnen über ein Datenfeld zugeordnet sind –
          Bestellungen, Abwesenheiten, Serviceanfragen, Lesebestätigungen und Protokolleinträge. Freitexte anderer
          Personen können Sie nennen, ohne dass ein Feld darauf zeigt; welche Stellen das sind, führt die Datei auf.
        </p>
        <a
          href="/profil/auskunft"
          className="mt-4 inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Auskunft herunterladen
        </a>
      </Section>

      <Section
        title="Passwort ändern"
        subtitle={
          session.mustChangePassword
            ? "Sie nutzen noch ein Startpasswort – bitte ändern Sie es jetzt."
            : "Mindestens zehn Zeichen"
        }
      >
        <PasswordForm />
      </Section>
    </AppShell>
  );
}
