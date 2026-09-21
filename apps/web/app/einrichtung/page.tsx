import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui";
import { EinrichtungsChecklist } from "@/components/einrichtungs-checklist";
import { EinrichtungNeustartButton } from "./einrichtung-neustart-button";
import { getEinrichtungStatus, requireSession } from "@/lib/session";

/**
 * Vollständige Ansicht der Ersteinrichtung.
 *
 * Nicht zu verwechseln mit `/onboarding` (Einarbeitung neuer Mitarbeitender).
 * Die verkürzte Checkliste steht bereits im Dashboard - diese Seite ist das
 * Ziel für "Einrichtung erneut starten" (Profil) und für Personen, die den
 * Assistenten übersprungen haben und ihn bewusst wieder aufrufen.
 */
export default async function EinrichtungPage() {
  await requireSession();
  const status = await getEinrichtungStatus();

  return (
    <AppShell title="Ersteinrichtung" subtitle="Grundsetup Ihres Arbeitsbereichs">
      {status ? (
        <>
          <EinrichtungsChecklist status={status} erlaubeAusblenden={false} />
          <div className="flex justify-end">
            <EinrichtungNeustartButton />
          </div>
        </>
      ) : (
        <EmptyState title="Kein Stand verfügbar" detail="Die Ersteinrichtung konnte nicht geladen werden." />
      )}
    </AppShell>
  );
}
