# Sicherheit

Stand der technischen Maßnahmen, was bewusst offen ist, und wie der externe
Penetrationstest vorbereitet wird. Maßstab ist OWASP ASVS Level 2; das ist eine
Orientierung, **keine Bescheinigung**. Wer nach außen „ASVS-konform“ sagt, muss
das vorher unabhängig prüfen lassen.

## Umgesetzt

| Bereich        | Maßnahme                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anmeldung      | bcrypt (Kosten 12), Dummy-Vergleich gegen Zeitkanal, Kontosperre nach 5 Fehlversuchen, IP-Drosselung, Sitzungsende bei Sperre/Rollenentzug/Passwortwechsel          |
| Zweiter Faktor | TOTP (RFC 6238) mit Wiederherstellungscodes, je Haus vorschreibbar, für Plattformkonten immer; Einmalverwendung je Zeitschritt; Zwischentoken mit eigenem Schlüssel |
| Sitzung        | JWT HS256 (Algorithmus fest vorgegeben), httpOnly-Cookie, `sameSite=lax`, `secure` in Produktion, 12 h                                                              |
| Zugriff        | Rechte serverseitig, Mandantentrennung im Datenzugriff (fail-closed), Aussperrsperre                                                                                |
| Eingaben       | `class-validator` mit `forbidNonWhitelisted`, Prisma statt Rohabfragen, Logo-Upload prüft den Dateikopf                                                             |
| Transport      | HTTPS mit On-Demand-Zertifikaten (`Caddyfile.tls`), HSTS                                                                                                            |
| Browser        | Content-Security-Policy mit Einmalkennung, `X-Frame-Options`, `nosniff`, Referrer-/Permissions-Policy; Schrift ohne Drittanbieter                                   |
| Lieferkette    | Lockfile eingefroren (auch im Image), `pnpm audit` ab „high“ in der CI, Dependabot, CodeQL, Geheimnissuche, SBOM (CycloneDX)                                        |
| Betrieb        | Container ohne root, `no-new-privileges`, ohne Linux-Fähigkeiten, `.dockerignore`; Sicherung und Wiederherstellung werden in jeder CI-Runde geprobt                 |

## Bewusst offen

- **Entwicklungswerkzeuge (Vite, Vitest u. a.):** `pnpm audit` ohne `--prod` zeigt
  Meldungen. Sie laufen nie auf einem Server und blockieren die CI nicht.
- **Basis-Images nicht auf Digest gepinnt:** Dependabot hebt die Tags an, ein
  Digest-Pin wäre die nächste Stufe. Ohne Zugriff auf die Registry lässt er sich
  hier nicht sauber setzen.
- **Landingpage (`landing/index.html`)** lädt die Schrift noch von Google Fonts.
  Sie ist statisch und hat keine Anmeldung, übermittelt aber IP-Adressen. Beim
  nächsten Anfassen auf die lokalen Schriften umstellen (`docs/ci.md`).
- **`security.txt`** fehlt: sie braucht eine echte Kontaktadresse für
  Schwachstellenmeldungen, und die muss jemand zusagen, der sie liest.
- **Audit-Log nicht manipulationssicher,** Sicherungen nur lokal (siehe
  „Bekannte Lücken“ in `CLAUDE.md`).
- **Passwortregeln:** nur Mindestlänge 10. Ein Abgleich gegen bekannte
  kompromittierte Passwörter fehlt.
- **Docker-Images** wurden in dieser Umgebung nicht gebaut (kein Docker-Daemon).
  Der erste echte Bau gehört beobachtet, besonders der Start als Nutzer `node`.

## Externer Penetrationstest

Der Test selbst ist Sache einer externen Stelle. Vorbereitung:

**Umfang**

- Web-Oberfläche und API einer Testinstallation (nicht Produktion), mindestens
  zwei Häuser plus Plattformverwaltung.
- Schwerpunkte: Mandantentrennung (Zugriff auf Daten eines anderen Hauses),
  Rechteumgehung, Anmeldung samt zweitem Faktor und Zurücksetzen, Sitzungen,
  Datei-Upload (Logo), Auskunft und Anonymisierung (Datenschutz).
- Ausdrücklich gewünscht: der Pfad `$queryRaw` (siehe `CLAUDE.md`) und alles, was
  `runUnscoped` verwendet.

**Ausgeschlossen:** Lasttests und Dienstverweigerung, Social Engineering, die
Infrastruktur des Hosters.

**Bereitzustellen:** Testinstallation mit Seed-Daten (`prisma:seed`), je ein
Konto pro Rolle in zwei Häusern, ein Plattformkonto, die Datei `docs/recht.md`
für den Kontext, ein Ansprechpartner.

**Abnahme:** Bericht mit Schweregraden nach CVSS, Nachtest der als „hoch“ oder
„kritisch“ eingestuften Funde. Der Bericht ist der Nachweis, den Kunden und
Auditoren verlangen; die Funde gehören in den Änderungsverlauf.

## Weg zur ISO-27001-Zertifizierung

Technik allein genügt nicht – zertifiziert wird der Betreiber mit seinen
Prozessen. Offen sind dort: Informationssicherheitsleitlinie, Risikoanalyse,
Notfall- und Meldeprozess (72 Stunden nach Art. 33 DSGVO), ein benannter
Informationssicherheitsbeauftragter und die Auswahl einer akkreditierten
Zertifizierungsstelle. Vieles davon steht inhaltlich schon in `docs/` und müsste
in eine prüffähige Form gebracht werden.
