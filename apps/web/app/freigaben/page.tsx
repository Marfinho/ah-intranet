import { pendingApprovals } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { ApprovalsBoard } from "@/components/approvals-board";
import { Section } from "@/components/ui";

export default function ApprovalsPage() {
  return (
    <AppShell title="Freigaben" subtitle="Einfacher 1-stufiger Review-Prozess für Visitenkarten und Arbeitskleidung">
      <Section title="Offene und laufende Freigaben" subtitle="Admins und Fachbereichsadmins bearbeiten Bestellungen innerhalb vorbereiteter Scopes">
        <ApprovalsBoard tasks={pendingApprovals} />
      </Section>
    </AppShell>
  );
}
