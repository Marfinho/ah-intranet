import type { Poll } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { PollCard } from "@/components/poll-card";
import { PollComposer } from "./poll-composer";
import { apiGet } from "@/lib/api";
import { getZielgruppen, requireModule } from "@/lib/session";

interface PollsResponse {
  items: Poll[];
  canManage: boolean;
}

export default async function PollsPage({ searchParams }: { searchParams: { all?: string } }) {
  await requireModule("polls");

  const showAll = searchParams.all === "true";
  const data = await apiGet<PollsResponse>(`/polls${showAll ? "?all=true" : ""}`);
  const katalog = await getZielgruppen();

  return (
    <AppShell title="Umfragen" subtitle="Kurzabstimmungen mit Auswertung in Echtzeit">
      {data.canManage ? (
        <Section title="Neue Umfrage" subtitle="Eine Stimme pro Person, Änderung jederzeit möglich">
          <PollComposer katalog={katalog} />
        </Section>
      ) : null}

      <Section
        title={showAll ? "Alle Umfragen" : "Laufende Umfragen"}
        subtitle="Klicken Sie auf eine Antwort, um abzustimmen"
      >
        {data.items.length === 0 ? (
          <EmptyState title="Keine Umfragen" detail="Derzeit läuft keine Abstimmung." />
        ) : (
          <div className="space-y-4">
            {data.items.map((poll) => (
              <PollCard key={poll.id} poll={poll} canManage={data.canManage} katalog={katalog} />
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
