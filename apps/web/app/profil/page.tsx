import { currentUser } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { InfoList, Section } from "@/components/ui";

export default function ProfilePage() {
  return (
    <AppShell title="Profil" subtitle="Eigene Stammdaten, Rolle und vorbereitete Organisationsstruktur">
      <Section title="Mein Profil" subtitle="Standort, Abteilung und Fachbereich sind für spätere Prozesse bereits vorgesehen">
        <InfoList
          items={[
            { label: "Benutzername", value: currentUser.username },
            { label: "Anzeigename", value: currentUser.displayName },
            { label: "Rolle", value: currentUser.role },
            { label: "Scope", value: currentUser.scope },
            { label: "Standort", value: currentUser.location ?? "Nicht zugeordnet" },
            { label: "Abteilung", value: currentUser.department ?? "Nicht zugeordnet" },
            { label: "Fachbereich", value: currentUser.specialtyArea ?? "Nicht zugeordnet" },
            { label: "E-Mail", value: currentUser.email ?? "Keine Firmen-E-Mail hinterlegt" },
          ]}
        />
      </Section>
    </AppShell>
  );
}
