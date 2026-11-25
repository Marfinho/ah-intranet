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
- **Aktualisierung**: Hauptzweig von GitHub holen und installieren (siehe unten).
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

## Aktualisieren (Hauptzweig von GitHub holen und installieren)

Unter **Verwaltung → Aktualisierung** sieht der Betreiber, welcher Stand läuft, was
auf `main` neu ist (Commits, betroffene Dateien, Hinweise zu Migrationen), ob die
Prüfpipeline dieses Standes grün ist, und kann das Update mit einem Klick
anfordern. Nur `inhaber`; zur Bestätigung ist das Passwort noch einmal nötig.

**Wer was tut - und warum nicht anders:**

```
Verwaltung (Container)            Aktualisierer (Skript auf dem Server)
  zeigt Stand, prüft, legt          läuft jede Minute als root (cron):
  einen AUFTRAG in der Datenbank ─▶ holt main, sichert, baut, startet,
  ◀─ liest Protokoll und Ergebnis   prüft, rollt bei Fehler zurück
```

Die Verwaltung baut und startet nichts selbst und hat **keinen Zugriff auf Docker**.
Dürfte ein Webdienst Container steuern, wäre jede Lücke in ihm eine Lücke im Server.
Außerdem müsste sie sich dabei selbst ersetzen. Der Aktualisierer ist ein
kleines Skript außerhalb der Container (`scripts/aktualisierer.sh`); es hat keinen
Netzzugang von außen, sondern liest nur die Datenbank und GitHub.

**Was geprüft wird, bevor etwas geschieht** (Verwaltung _und_ Skript, das der
Datenbank nicht glaubt):

- Der Zielstand liegt auf `main` und ist **neuer** als der installierte (Zurückgehen
  ist kein Update, sondern ein Eingriff von Hand).
- Die **Prüfpipeline des Standes ist grün**. Rot, laufend oder fehlend blockiert -
  ohne Beweis kein Einspielen. Es gibt keinen Schalter, das zu übergehen.
- Es gibt keinen zweiten Auftrag (die Datenbank lässt nur einen aktiven zu), der
  Aktualisierer meldet sich (Lebenszeichen jede Minute), genug Platz ist frei, das
  Installationsverzeichnis hat keine lokalen Änderungen.

**Ablauf des Skripts:** Sicherung der Datenbank → Stand wechseln → nur geänderte
Images bauen (nacheinander) → Datenbankrolle der Verwaltung einspielen → starten
(die Migrationen laufen beim Start) → warten, bis API, Verwaltung und Oberfläche
gesund melden. Das Protokoll erscheint live in der Oberfläche.

**Wenn etwas schiefgeht:** Das Skript geht zurück auf den alten Code und die alten
Images (`ahoi-<dienst>:vorher`) und meldet „zurückgerollt“. **Grenze:** Datenbank-
migrationen gehen nur vorwärts. Wurden welche angewendet, bevor der Fehler auftrat,
läuft der alte Code gegen das neue Schema - meist verträglich, nicht garantiert.
Die Meldung sagt das ausdrücklich und nennt die Sicherung
(`scripts/wiederherstellung.sh`). Scheitert auch der Rückweg, steht dort
„MANUELL EINGREIFEN“.

**Einrichten (einmalig, als root auf dem Server):**

```bash
echo '* * * * * root /opt/ah-intranet/scripts/aktualisierer.sh >>/var/log/ahoi-aktualisierer.log 2>&1' \
  >/etc/cron.d/ahoi-aktualisierer && chmod 644 /etc/cron.d/ahoi-aktualisierer
```

`vps-einrichten.sh` trägt das selbst ein. Das Repository muss ohne Anmeldung
lesbar sein (`git fetch origin main`) - oder der Server hat einen Deploy-Schlüssel.
Für ein **privates** Repository zusätzlich `GITHUB_TOKEN` (nur Leserecht auf
Inhalte und Checks) in der `.env` und `GITHUB_REPO=<owner>/<name>` setzen, falls es
nicht `Marfinho/ah-intranet` ist.

Beim ersten Lauf hält der Aktualisierer den aktuell ausgecheckten Stand als
„installiert“ fest - das stimmt, wenn die Container aus diesem Stand gebaut sind
(so richtet `vps-einrichten.sh` es ein). Bei einem Zweifel: einmal von Hand
`docker compose -f docker-compose.prod.yml up -d --build`, dann gilt es.

**Grenzen (ehrlich benannt):**

- Während des Neustarts sind die Häuser und diese Verwaltung kurz nicht erreichbar;
  die Oberfläche versucht es weiter, bis der Auftrag beendet ist.
- Ein Update des Aktualisierers selbst (`scripts/aktualisierer.sh`) gilt erst beim
  **nächsten** Lauf; der laufende liest sein Skript als Ganzes ein.
- Compose-Änderungen mit neuen Pflichteinstellungen in der `.env` brechen den Start
  ab und lösen den Rückweg aus; die Hinweise der Oberfläche nennen die betroffene Datei.
- Es wird nur `main` installiert, nicht ein beliebiger Zweig oder Tag.
- Die Pipeline-Prüfung verlässt sich auf GitHub; ohne Netz zu GitHub gibt es keine
  Aktualisierung (die Seite zeigt den Grund). Unangemeldet erlaubt GitHub 60 Anfragen
  je Stunde, das reicht, die Antworten werden kurz zwischengespeichert.

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
