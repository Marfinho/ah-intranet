import type { AuthProviderDefinition, AuthProviderSummary } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui";
import { AuthProviderForm } from "./auth-provider-form";
import { apiGet } from "@/lib/api";
import { requirePermission } from "@/lib/session";

interface Antwort {
  arten: AuthProviderDefinition[];
  hinterlegt: AuthProviderSummary[];
}

export default async function AnmeldungAdminPage() {
  await requirePermission("auth.manage");

  const { arten, hinterlegt } = await apiGet<Antwort>("/anmeldeverfahren");

  return (
    <AppShell title="Anmeldung" subtitle="Wie sich die Menschen in diesem Haus anmelden">
      <Section title="Passwort" subtitle="Der Grundweg – immer aktiv und nicht abschaltbar">
        <div className="rounded-2xl border border-slate-200 p-5 text-sm text-slate-600">
          <p>
            Jedes Haus startet ohne Vorbedingung, und der Zugang funktioniert auf jedem Gerät – auch vom privaten
            Telefon in der Halle. Passwörter liegen als bcrypt-Hash; nach mehreren Fehlversuchen sperrt das Konto
            vorübergehend.
          </p>
          <p className="mt-3">
            Eine zusätzliche Anmeldeart ersetzt das Passwort nicht, sie kommt daneben. Wer sie nicht nutzen kann, meldet
            sich weiterhin wie bisher an.
          </p>
        </div>
      </Section>

      {arten.map((art) => (
        <Section key={art.kind} title={art.name} subtitle={art.description}>
          <AuthProviderForm art={art} eintrag={hinterlegt.find((entry) => entry.kind === art.kind) ?? null} />
        </Section>
      ))}
    </AppShell>
  );
}
