/**
 * Name und Schärfe des Sitzungscookies - an einer Stelle, weil API und
 * Oberfläche ihn beide setzen und beide lesen müssen.
 */

const BASIS = "ah_session";

/**
 * Sind die verschärften Cookie-Eigenschaften aktiv?
 *
 * **Warum ein eigener Schalter und nicht einfach `NODE_ENV`.** API und
 * Oberfläche sind zwei Prozesse. Leiteten beide den Cookienamen je für sich
 * aus `NODE_ENV` ab, genügte eine Abweichung, und die Anmeldung wäre kaputt:
 * Die API setzte `ah_session`, die Oberfläche suchte `__Host-ah_session` - der
 * Anmeldeversuch endete mit "Die Sitzung konnte nicht gesetzt werden".
 *
 * Das ist kein erfundener Fall: `next start` setzt `NODE_ENV=production` von
 * sich aus, während die API ohne gesetzte Variable in der Entwicklung bleibt.
 * Genau diese Kombination liefert die mitgelieferte `docker-compose.yml`.
 *
 * Deshalb entscheidet eine ausdrückliche Variable, die beide Dienste
 * bekommen. Ohne sie gilt `NODE_ENV` als Rückfallebene.
 *
 * Die Umgebung wird übergeben, nicht gelesen: Dieses Paket läuft in der API,
 * im Node-Server der Oberfläche und in deren Edge-Middleware. Ein Zugriff auf
 * `process` darin würde es an eine davon binden.
 */
export function sichereCookiesAktiv(env: Record<string, string | undefined>): boolean {
  const explizit = env.AHOI_SECURE_COOKIES;
  if (explizit !== undefined && explizit !== "") {
    return explizit.trim().toLowerCase() === "true";
  }
  return env.NODE_ENV === "production";
}

/**
 * Mit gesetztem Schalter trägt das Cookie den `__Host-`-Präfix.
 *
 * Der Präfix ist eine Zusage, die der Browser durchsetzt: Er nimmt ein solches
 * Cookie **nur über HTTPS** an, nur mit `Path=/` und **nur ohne**
 * `Domain`-Angabe. Damit kann kein Dienst auf einer Nachbardomain - etwa
 * `werkstatt.example.de` neben `intranet.example.de` - ein Cookie für unseren
 * Ursprung unterschieben.
 *
 * **Folge für den Betrieb:** Hinter reinem HTTP funktioniert die Anmeldung mit
 * gesetztem Schalter nicht. Das ist beabsichtigt - eine Sitzung im Klartext
 * über das Netz ist nichts, was die Anwendung stillschweigend mittragen
 * sollte. Siehe `docs/betrieb.md`.
 */
export function sitzungsCookieName(sicher: boolean): string {
  return sicher ? `__Host-${BASIS}` : BASIS;
}

export const SITZUNG_COOKIE_BASIS = BASIS;
