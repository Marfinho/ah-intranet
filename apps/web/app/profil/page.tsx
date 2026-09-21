import Link from "next/link";
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
        />
      </Section>

      <Section title="Einrichtung" subtitle="Grundsetup Ihres Arbeitsbereichs">
        <p className="text-sm text-slate-600">
          Die Ersteinrichtung führt neu angemeldete Personen durch das Grundsetup - übersprungene oder abgeschlossene
          Schritte lassen sich hier jederzeit erneut aufrufen.
        </p>
        <Link href="/einrichtung" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
          Zur Ersteinrichtung
        </Link>
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
