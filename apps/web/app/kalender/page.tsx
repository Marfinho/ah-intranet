import { calendarEvents } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { CalendarBoard } from "@/components/calendar-board";
import { Section } from "@/components/ui";

export default function KalenderPage() {
  return (
    <AppShell title="Kalender & Termine" subtitle="Schulungen, Aktionen, Wartungen und Sammeltermine im Überblick">
      <Section title="Termine" subtitle="Zielgruppen- und standortübergreifende Ereignisse für den Arbeitsalltag">
        <CalendarBoard events={calendarEvents} />
      </Section>
    </AppShell>
  );
}
