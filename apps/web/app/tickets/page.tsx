import { tickets } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui";
import { TicketBoard } from "@/components/ticket-board";

export default function TicketsPage() {
  return (
    <AppShell title="Serviceanfragen" subtitle="IT-, Facility-, HR- und Marketing-Anfragen strukturiert verfolgen">
      <Section title="Offene Tickets" subtitle="Interne Serviceprozesse transparent und nachvollziehbar abbilden">
        <TicketBoard tickets={tickets} />
      </Section>
    </AppShell>
  );
}
