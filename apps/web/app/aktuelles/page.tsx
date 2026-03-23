import { newsItems } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { NewsListClient } from "@/components/news-list-client";
import { Section } from "@/components/ui";

export default function NewsListPage() {
  return (
    <AppShell title="Aktuelles" subtitle="Interne News mit Prioritäten, Anhängen, Zielgruppen und Veröffentlichungslogik">
      <Section title="Veröffentlichte Meldungen" subtitle="Global, standortbezogen, abteilungsbezogen oder fachbereichsspezifisch aussteuerbar">
        <NewsListClient items={newsItems} />
      </Section>
    </AppShell>
  );
}
