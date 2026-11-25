import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { MfaPanel } from "./mfa-panel";

export default async function MfaPage() {
  // Hier muss die Sitzung auch dann zugänglich sein, wenn der Faktor noch fehlt -
  // die Seite ist ja der Weg dorthin.
  const session = await requireSession({ mfaEinrichtung: true });

  return (
    <AppShell title="Zweiter Faktor" subtitle="Anmeldung mit Authenticator-App" mfaEinrichtung>
      {session.mfa.einrichtungOffen ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {session.isPlatformAdmin
            ? "Für Konten der Plattformverwaltung ist der zweite Faktor vorgeschrieben."
            : "Ihr Haus schreibt den zweiten Faktor vor."}{" "}
          Bis zur Einrichtung ist nur diese Seite erreichbar.
        </div>
      ) : null}

      <Section
        title={session.mfa.aktiv ? "Eingerichtet" : "Einrichten"}
        subtitle="Funktioniert mit jeder App für Einmalcodes, z. B. Google Authenticator, Microsoft Authenticator oder Aegis"
      >
        <MfaPanel aktiv={session.mfa.aktiv} pflicht={session.mfa.pflicht} />
      </Section>
    </AppShell>
  );
}
