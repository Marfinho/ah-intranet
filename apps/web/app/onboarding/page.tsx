import { onboardingTemplates } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { OnboardingLibrary } from "@/components/onboarding-library";
import { Section } from "@/components/ui";

export default function OnboardingPage() {
  return (
    <AppShell title="Onboarding" subtitle="Vorlagen und Checklisten für strukturierte Einstiege in Verkauf und Service">
      <Section title="Onboarding-Vorlagen" subtitle="Rollenbasierte Pakete für neue Mitarbeitende und Fachbereiche">
        <OnboardingLibrary templates={onboardingTemplates} />
      </Section>
    </AppShell>
  );
}
