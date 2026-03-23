import { notifications } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { NotificationCenterClient } from "@/components/notification-center-client";
import { Section } from "@/components/ui";

export default function BenachrichtigungenPage() {
  return (
    <AppShell title="Benachrichtigungen" subtitle="In-App-Hinweise und optionale E-Mail-Benachrichtigungen an einem Ort">
      <Section title="Nachrichten-Center" subtitle="Filterbar nach Kanal und Inhalt">
        <NotificationCenterClient items={notifications} />
      </Section>
    </AppShell>
  );
}
