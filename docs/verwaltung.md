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

## Interessenten und Hausanlage

Beides liegt vollständig hier; in der Kunden-Anwendung gibt es dafür keine
Oberfläche und keine Schnittstelle mehr. Dort bleibt nur die öffentliche
Pitch-Seite (`/angebot/<token>`).

- **Interessent anlegen**: Häuser als Textzeilen, Link wird einmalig angezeigt
  (gespeichert ist nur der SHA-256-Hash; die Pitch-Seite der Kunden-Anwendung
  prüft denselben Hash). Neuer Link, Widerruf, Löschen, Bearbeiten.
  `PITCH_BASIS_URL` setzt die Adresse der Pitch-Seite (Betreiber-Mandant, z. B.
  `https://verwaltung.<domain>`), sonst zeigt die Oberfläche nur den Pfad.
- **Haus aus Interessent anlegen**: Vorschau, dann Kennung und erstes Konto.
  Standorte, Marken, Abteilungen, Module und Lizenzkontingent kommen aus dem
  Interessenten; Erprobungen bleiben aus. Ein Interessent wird höchstens einmal
  zum Haus. **Neues Haus ohne Interessent** unter Häuser → Neues Haus.
- Die Rechenregeln (Haus-Plan, Kennung, Konfiguration, Preisliste) liegen im
  gemeinsamen Paket `packages/shared` und gelten für Pitch-Seite und
  Verwaltung gleich.

**Die Datenbank legt das Haus an, nicht die Verwaltung.** Die Rolle bekommt kein
`INSERT` auf Konten, Rollen oder Standorte, sondern nur `EXECUTE` auf
`verwaltung_haus_anlegen(jsonb)` (`scripts/verwaltung-rolle.sql`). Die Funktion
erzeugt ausschließlich einen **neuen** Mandanten samt Rechten, Rollen, Standorten
und erstem Administrationskonto in einer Transaktion. Ein bestehendes Haus lässt
sich damit nicht verändern - auch eine gestohlene Verwaltungsrolle kommt so nicht
an die Konten eines laufenden Hauses. Das Passwort geht als bcrypt-Hash hinein.
Ändert sich das Schema der Häuser (neue Pflichtspalte), bricht die Funktion; die
CI fängt das (`PRUEFUNG_HAUS_ANLEGEN=1`), und das Rollenskript muss neu eingespielt
werden.

## Grenzen (ehrlich benannt)

- Der Betreiber-Mandant (`verwaltung`, mit Konten der alten Plattformverwaltung)
  bleibt in der Kunden-Anwendung bestehen: dort wohnen die Interessenten, über
  seine Adresse wird die Pitch-Seite aufgelöst. Seine Konten braucht niemand mehr
  zum Arbeiten; die alten Seiten unter `/plattform` (Häuserliste, Module,
  Kennzahlen, Systemstatus) laufen noch parallel und können als Nächstes entfallen.
- Änderungen an Häusern (Sperre, Module) wirken in der Kunden-Anwendung nach den
  Zwischenspeichern dort: Mandant bis 30 s, Module bis 15 s.
- Betreiberkonten werden per Skript verwaltet, nicht in der Oberfläche.
- Der zweite Faktor wird per Geheimnis eingetragen; ein QR-Code ist nicht gebaut.
- `totp.ts`, `geheimnis.ts` und `pitch-link.ts` sind Kopien aus `apps/api`, damit
  die Verwaltung ohne Abhängigkeit vom Kundendienst baut. Änderungen an beiden
  Stellen; die Tests sind dieselben.
