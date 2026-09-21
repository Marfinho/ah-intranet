import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui";
import { apiBaseUrl, tenantHostHeader } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { LogoUploader } from "./logo-uploader";

export default async function ErscheinungsbildPage() {
  await requirePermission("branding.manage");

  // Kein eigener JSON-Endpunkt nötig: das Bild selbst beantwortet die Frage,
  // ob eins hinterlegt ist (200 oder 404) - genau das, was der Browser später
  // ohnehin abruft.
  const antwort = await fetch(`${apiBaseUrl()}/branding/logo`, { headers: tenantHostHeader(), cache: "no-store" });
  const hasLogo = antwort.ok;

  return (
    <AppShell title="Erscheinungsbild" subtitle="Eigenes Logo für dieses Haus hinterlegen">
      <Section
        title="Logo"
        subtitle="Ersetzt das AHOI-Zeichen in Kopfzeile und Anmeldeseite dieses Hauses vollständig"
      >
        <LogoUploader hasLogo={hasLogo} />
      </Section>
    </AppShell>
  );
}
