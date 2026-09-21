/**
 * Name des Sitzungscookies - an einer Stelle, weil API und Oberfläche ihn
 * beide setzen und beide lesen müssen.
 */

const BASIS = "ah_session";

/**
 * Im Produktivbetrieb mit `__Host-`-Präfix.
 *
 * Der Präfix ist eine Zusage an den Browser, die dieser durchsetzt: Er nimmt
 * ein solches Cookie nur über HTTPS an, nur mit `Path=/` und **nur ohne**
 * `Domain`-Angabe. Damit kann kein anderer Dienst auf einer Nachbardomain
 * - etwa `werkstatt.example.de` neben `intranet.example.de` - ein Cookie für
 * unseren Ursprung unterschieben. Ohne den Präfix ist genau das möglich.
 *
 * Außerhalb der Produktion bleibt der schlichte Name: über `http://localhost`
 * würde der Browser das Cookie mit Präfix verwerfen, und eine Entwicklung, in
 * der die Anmeldung nicht funktioniert, hilft niemandem.
 *
 * **Folge für den Betrieb:** Mit `NODE_ENV=production` hinter reinem HTTP
 * funktioniert die Anmeldung nicht mehr. Das ist beabsichtigt - eine Sitzung
 * im Klartext über das Netz ist kein Zustand, den die Anwendung stillschweigend
 * mittragen sollte. Siehe `docs/betrieb.md`.
 */
export function sitzungsCookieName(istProduktion: boolean): string {
  return istProduktion ? `__Host-${BASIS}` : BASIS;
}

export const SITZUNG_COOKIE_BASIS = BASIS;
