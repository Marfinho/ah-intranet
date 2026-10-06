/**
 * Adresse eines Hauses, wie ein Mensch sie im Browser aufruft - für Links in
 * E-Mails (Zurücksetzen des Passworts, Benachrichtigungen).
 *
 * Reine Funktion über die Umgebung. `FRONTEND_URL` taugt dafür allein nicht:
 * Mit mehreren Häusern ist sie eine Liste erlaubter Ursprünge für CORS, und ein
 * Link, der aus dieser Liste zusammengesetzt wird, ist kaputt - und selbst mit
 * einer einzigen Adresse führte er jedes Haus zur Adresse des ersten.
 */

export interface HausAdresse {
  slug: string;
  domain: string | null;
}

function ersterUrsprung(frontendUrl: string | undefined): string {
  return (frontendUrl ?? "").split(",")[0]?.trim().replace(/\/+$/, "") ?? "";
}

/** Liefert die Basisadresse ohne Schrägstrich am Ende, oder "" wenn nichts bekannt ist. */
export function hausAdresse(haus: HausAdresse, env: Record<string, string | undefined>): string {
  const ursprung = ersterUrsprung(env.FRONTEND_URL);
  // Das Schema übernehmen wir von der Konfiguration, die der Betreiber ohnehin
  // pflegen muss: wer FRONTEND_URL mit http:// einträgt, hat kein TLS.
  const schema = ursprung.startsWith("http://") ? "http" : "https";

  if (haus.domain) {
    return `${schema}://${haus.domain}`;
  }
  const basis = env.BASE_DOMAIN?.trim();
  if (basis) {
    return `${schema}://${haus.slug}.${basis}`;
  }
  return ursprung;
}
