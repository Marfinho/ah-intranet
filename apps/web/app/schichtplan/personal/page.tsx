import Link from "next/link";
import type { ArbeitszeitProfil } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { ProfilZeile } from "./profil-zeile";
import { apiGet } from "@/lib/api";
import { requireModule, requirePermission } from "@/lib/session";

export default async function ArbeitszeitProfilePage() {
  await requireModule("shifts");
  await requirePermission("shifts.manage");
  const profile = await apiGet<ArbeitszeitProfil[]>("/schichtplanung/personal");

  return (
    <AppShell
      title="Arbeitszeitprofile"
      subtitle="Wochenarbeitszeit, Zeitfenster und Arbeitstage - wann eine Person eingeplant werden kann"
    >
      <p className="text-sm">
        <Link href="/schichtplan" className="font-semibold text-brand-700 hover:underline">
          ← Zurück zum Schichtplan
        </Link>
      </p>

      <Section
        title={`${profile.length} Personen`}
        subtitle="Teilzeitkräfte, die nur vormittags arbeiten, bekommen ein Zeitfenster; ohne Fenster gilt: ganztags"
      >
        {profile.length === 0 ? (
          <EmptyState title="Keine Personen" detail="Es gibt noch keine aktiven Konten." />
        ) : (
          <ul className="space-y-3">
            {profile.map((profil) => (
              <ProfilZeile key={profil.id} profil={profil} />
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
