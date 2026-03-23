import { employeeDirectory } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmployeeDirectoryClient } from "@/components/employee-directory-client";
import { Section } from "@/components/ui";

export default function MitarbeiterPage() {
  return (
    <AppShell title="Mitarbeiterverzeichnis" subtitle="Telefonbuch, Zuständigkeiten und Standortinformationen für alle Teams">
      <Section title="Verzeichnis" subtitle="Suche nach Name, Bereich, Standort oder Verantwortlichkeit">
        <EmployeeDirectoryClient entries={employeeDirectory} />
      </Section>
    </AppShell>
  );
}
