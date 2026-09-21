import { redirect } from "next/navigation";
import type { PlatformStaffSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { StaffPermissionEditor } from "./staff-permission-editor";
import { StaffSearch } from "./staff-search";

export default async function PlatformStaffPage() {
  const session = await requireSession();
  // Wer Plattformrechte vergeben darf, entscheidet allein der Betreiber - wie
  // beim Anlegen eines Hauses lässt sich das nicht aus dem Haus heraus vergeben.
  if (!session.isPlatformAdmin) {
    redirect("/admin");
  }

  const staff = await apiGet<PlatformStaffSummary[]>("/plattform/mitarbeiter");

  return (
    <AppShell
      title="Mitarbeiter der Verwaltung"
      subtitle="Wer Rechte der Plattformverwaltung trägt, gleich in welchem Haus das Konto sitzt"
    >
      <Section title={`${staff.length} Konten mit Plattformbezug`} subtitle="Betreiber und einzeln freigeschaltete Mitarbeitende">
        {staff.length === 0 ? (
          <EmptyState title="Noch niemand freigeschaltet" detail="Suchen Sie unten ein Konto, um es freizuschalten." />
        ) : (
          <div className="space-y-3">
            {staff.map((entry) => (
              <StaffPermissionEditor key={entry.id} staff={entry} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Mitarbeitenden freischalten"
        subtitle="Ein Konto irgendeines Hauses suchen und mit Rechten versehen"
      >
        <StaffSearch existingIds={staff.map((entry) => entry.id)} />
      </Section>
    </AppShell>
  );
}
