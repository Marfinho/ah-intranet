import { documents } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DocumentLibraryClient } from "@/components/document-library-client";
import { Section } from "@/components/ui";

export default function DokumentePage() {
  return (
    <AppShell title="Dokumente & Vorlagen" subtitle="Zentrale Ablage für Prozesse, CI-Unterlagen, Anleitungen und Pflichtdokumente">
      <Section title="Dokumentenbibliothek" subtitle="Durchsuchbar nach Titel, Kategorie, Verantwortlichen und Zielgruppen">
        <DocumentLibraryClient documents={documents} />
      </Section>
    </AppShell>
  );
}
