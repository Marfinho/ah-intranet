# Verwaltung (Betreiber-Backend)

Eigene Anwendung für den Betreiber: Kunden, Interessenten, Statistiken und
Systemwerte. Sie liegt in `apps/verwaltung` und ist **kein Teil** der
Kunden-Anwendung (`apps/api`, `apps/web`).

## Warum getrennt

Die frühere Plattformverwaltung wohnte als Mandant in der Kunden-Anwendung: gleiche
Anmeldung, gleicher Prozess, gleicher Schlüssel. Wer dort Konten erbeutete, stand
einen Schritt vor allen Häusern. Jetzt gilt:

|                   | Kunden-Anwendung               | Verwaltung                                                  |
| ----------------- | ------------------------------ | ----------------------------------------------------------- |
| Prozess / Port    | `api` 3001, `web` 3000         | `verwaltung` 3002                                           |
| Adresse           | `<haus>.<domain>`              | `betrieb.<domain>` (Caddyfile.prod)                         |
| Konten            | Tabelle `User` je Haus         | Tabelle `Betreiber` (Schema `verwaltung`)                   |
| Sitzungsschlüssel | `JWT_SECRET`                   | `VERWALTUNG_JWT_SECRET` – Sitzungen sind nicht austauschbar |
| Zweiter Faktor    | je Haus                        | **immer**, ohne Ausnahme                                    |
| Datenbankzugang   | Besitzerrolle, Mandantenfilter | Rolle `ahoi_verwaltung`, nur Spalten ohne Personenbezug     |

## Was sie kann

- **Übersicht**: Kennzahlen, Hinweise (Lizenz fast voll, Haus ruht, Anfrage seit
  3 Tagen unbearbeitet, Link läuft ab), Vertriebstrichter.
- **Häuser**: Liste und Detail mit Auslastung, Aktivität, Nutzung je Bereich,
  Modulstand. Ändern: sperren, Lizenzkontingent, Standortlimit, Notiz, Module
  (samt Abhängigkeiten; Erprobungen nur hier).
- **Interessenten**: Trichter, Pipeline-Volumen, Abschlussquote; Stand ändern,
  Notiz, Link widerrufen.
- **Statistik**: Aktivität 90 Tage, neue Konten, Anmeldungen, Aktionsarten,
  Hausgrößen, Nutzung, Modulverbreitung, Bestellungen, Tickets, Sicherheit, und
  Verläufe aus täglichen Schnappschüssen.
- **System**: Zustand der Kunden-API, Datenbank (Größe, Verbindungen,
  Zwischenspeicher, Deadlocks, größte Tabellen), Migrationen, Alter der letzten
  Sicherung, Konfiguration ohne Geheimnisse, Registries.
- **Protokoll**: jede Änderung und jede Anmeldung, getrennt vom Audit-Log der Häuser.

Lesende Konten (`lesend`) sehen alles und ändern nichts.

## Datenschutz: nur Zahlen

Solange mit einem Haus kein Auftragsverarbeitungsvertrag besteht, darf der Betreiber
dessen Personendaten nicht einsehen. Das steht nicht im Programmcode, sondern in
der Datenbankrolle: `scripts/verwaltung-rolle.sql` gewährt `SELECT` nur auf
Spalten wie Mandant, Status, Zeitpunkte. Namen, Mailadressen, Hashes, Texte,
Abwesenheitsarten und der Linkhash der Interessenten sind unlesbar. `pnpm --filter
verwaltung pruefung:rolle` (läuft in der CI) beweist beides: verbotene Zugriffe
scheitern, alle Auswertungen laufen mit der Rolle. **Wer eine Abfrage um eine
Spalte erweitert, muss sie dort ausdrücklich freigeben** – das ist gewollt.

## Einrichten

```bash
# 1. Rolle in der Datenbank der Häuser (einmalig, als Datenbankbesitzer)
psql "$DATABASE_URL" -v passwort="'<zufallswert>'" -f scripts/verwaltung-rolle.sql

# 2. .env ergänzen: VERWALTUNG_DB_PASSWORD (= obiges Passwort), VERWALTUNG_JWT_SECRET,
#    VERWALTUNG_SECRET_KEY (openssl rand -hex 32). Der Start bricht bei Platzhaltern ab.

# 3. Starten; die eigenen Migrationen laufen beim Start
docker compose -f docker-compose.prod.yml up -d verwaltung

# 4. Erstes Konto (Passwort aus der Umgebung, nicht als Argument)
docker compose -f docker-compose.prod.yml exec -e BETREIBER_PASSWORT='…' verwaltung \
  pnpm --filter verwaltung betreiber:anlegen sven "Vor Nachname" inhaber
```

Beim ersten Anmelden richtet das Konto den zweiten Faktor ein und bekommt zehn
Wiederherstellungscodes. Ein erneuter Aufruf von `betreiber:anlegen` setzt ein
verlorenes Passwort zurück. Nach neuen Tabellen oder Spalten in der Auswertung:
Rollenskript erneut einspielen.

Täglich per Cron den Stand festhalten (ohne ihn gibt es keine Verläufe):

```bash
docker compose -f docker-compose.prod.yml exec -T verwaltung pnpm --filter verwaltung schnappschuss
```

Lokal: `apps/verwaltung/.env.example` kopieren, `pnpm --filter verwaltung prisma:generate`,
`pnpm --filter verwaltung prisma:migrate deploy`, `pnpm --filter verwaltung dev`.

## Grenzen (ehrlich benannt)

- **Anlegen** von Interessenten, Pitch-Link erzeugen und **Haus aus Interessent
  anlegen** liegen noch in der Plattformverwaltung der Kunden-Anwendung
  (`apps/api/src/modules/platform`, `apps/web/app/plattform`). Sie schreiben
  Daten, die die Pitch-Seite und die Hausanlage gemeinsam nutzen; sie zu
  verschieben heißt, deren Logik (Token, Vorlage, Transaktion) sauber
  herauszulösen statt zu kopieren. Bis dahin bleibt der alte Zugang bestehen.
- Änderungen an Häusern (Sperre, Module) wirken in der Kunden-Anwendung nach den
  Zwischenspeichern dort: Mandant bis 30 s, Module bis 15 s.
- Betreiberkonten werden per Skript verwaltet, nicht in der Oberfläche.
- Der zweite Faktor wird per Geheimnis eingetragen; ein QR-Code ist nicht gebaut.
- `totp.ts` und `geheimnis.ts` sind Kopien aus `apps/api/src/core`, damit die
  Verwaltung ohne Abhängigkeit vom Kundendienst baut. Änderungen an beiden Stellen.
