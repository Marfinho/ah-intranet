# Betrieb

Was zu tun ist, damit das Intranet läuft – und was zu tun ist, wenn es das nicht
tut.

## Überblick

| Teil      | Standard         | Prüfung                  |
| --------- | ---------------- | ------------------------ |
| API       | `:3001`, NestJS  | `GET /api/health`        |
| Frontend  | `:3000`, Next.js | `GET /login`             |
| Datenbank | PostgreSQL 16    | im Healthcheck enthalten |

Der Healthcheck prüft die Datenbankverbindung samt Antwortzeit und ob die
nötigen Schlüssel gesetzt sind. Er eignet sich als Ziel für einen Monitor; ein
`ok: false` ist ein Alarm, kein Hinweis.

## Umgebungsvariablen

| Variable              | Bedeutung                              | Bei Verlust                   |
| --------------------- | -------------------------------------- | ----------------------------- |
| `DATABASE_URL`        | Verbindung zur Datenbank               | –                             |
| `JWT_SECRET`          | signiert die Sitzungen                 | alle müssen sich neu anmelden |
| `SECRET_KEY`          | verschlüsselt hinterlegte Geheimnisse  | Geheimnisse sind unlesbar     |
| `FRONTEND_URL`        | erlaubte Herkunft für CORS und Cookies | –                             |
| `NODE_ENV`            | `production` schaltet HSTS ein         | –                             |
| `AHOI_SECURE_COOKIES` | `true` schärft das Sitzungscookie      | –                             |

`JWT_SECRET` ist der einzige Wert, dessen Verlust spürbar ist – und er kostet
nur eine neue Anmeldung. Ein gestohlenes Backup enthält trotzdem alle
Personendaten des Hauses; es gehört verschlüsselt abgelegt.

**Die API startet nicht mit einem untauglichen `JWT_SECRET`.** Abgewiesen werden
die Beispielwerte aus diesem Repository (`bitte-aendern-langer-zufallswert` und
Verwandte) sowie – mit `NODE_ENV=production` – alles unter 32 Zeichen. Ein
Startabbruch ist unbequem und genau deshalb richtig: mit einem Schlüssel, der
im Repository nachzulesen ist, ließe sich jede Sitzung fälschen, bis hin zur
Plattformverwaltung. Erzeugen mit:

```bash
openssl rand -base64 48
```

### `AHOI_SECURE_COOKIES` – beide Dienste, derselbe Wert

Mit `AHOI_SECURE_COOKIES=true` heißt das Sitzungscookie `__Host-ah_session` und
trägt `Secure`. Der Präfix ist eine Zusage, die der Browser durchsetzt: Er nimmt
ein solches Cookie **nur über HTTPS** an, nur mit `Path=/` und ohne
`Domain`-Angabe. Der Gegenwert: Kein Dienst auf einer Nachbardomain kann ein
Cookie für unseren Ursprung unterschieben.

**Zwei Regeln, beide unnachgiebig:**

1. **API und Oberfläche brauchen denselben Wert.** Es sind zwei Prozesse. Weicht
   einer ab, setzt die API `ah_session`, während die Oberfläche
   `__Host-ah_session` sucht – die Anmeldung endet mit „Die Sitzung konnte nicht
   gesetzt werden". Die Variable gibt es genau deshalb: `next start` setzt
   `NODE_ENV=production` von sich aus, die API tut das nicht. Ohne einen
   gemeinsamen, ausdrücklichen Schalter liefen die beiden auseinander.
2. **`true` nur hinter HTTPS.** Sonst verwirft der Browser das Cookie, und
   niemand kann sich anmelden. Das ist gewollt: eine Sitzung im Klartext über
   das Netz ist nichts, was die Anwendung stillschweigend mittragen sollte.

Ohne gesetzte Variable entscheidet `NODE_ENV` – als Rückfallebene für
Einzelprozess-Aufbauten, nicht als Empfehlung.

### Protokolle und ihre Frist

Die Anwendung schreibt je Anfrage eine JSON-Zeile mit Haus, Route, Status, Dauer
und **Benutzername** auf die Standardausgabe; Ausfälle des Audit-Protokolls
gehen als `art: "audit-ausfall"` auf die Standardfehlerausgabe.

Diese Zeilen liegen außerhalb der Reichweite von `retention.ts` – die Frist muss
die Protokolleinsammlung des Betriebs durchsetzen. **Vorgabe: höchstens drei
Jahre, entsprechend dem Audit-Log, eher kürzer.** Ein Anfrageprotokoll ohne
Frist ist eine zweite, unkontrollierte Personendatenhaltung und nach § 87 Abs. 1
Nr. 6 BetrVG mitbestimmungspflichtig – siehe
[`datenschutz.md`](datenschutz.md).

Zwei Zeilen lohnen einen Alarm: `art: "audit-ausfall"` (das Protokoll hat
Lücken) und ein Healthcheck mit `checks.audit.ok: false`.

## Sicherung

```bash
./scripts/sicherung.sh [zielverzeichnis]
```

- Dump im Custom-Format: komprimiert und **selektiv** wiederherstellbar. Bei
  einem versehentlich geleerten Modul lässt sich eine einzelne Tabelle
  zurückholen, ohne den ganzen Stand zurückzudrehen.
- Daneben eine SHA-256-Prüfsumme. Eine stillschweigend beschädigte Sicherung ist
  schlimmer als keine, weil man sich auf sie verlässt.
- Alte Sicherungen werden aufgeräumt (`SICHERUNG_BEHALTEN`, Standard 14).

Per Cron, versetzt zum Aufbewahrungslauf:

```cron
0 2 * * *  cd /opt/ah-intranet && ./scripts/sicherung.sh /var/backups/ah-intranet >> /var/log/ah-intranet/sicherung.log 2>&1
0 3 * * *  cd /opt/ah-intranet/apps/api && node dist/scripts/aufbewahrung.js >> /var/log/ah-intranet/aufbewahrung.log 2>&1
```

Die Sicherung läuft **vor** dem Löschlauf. Andersherum wäre der erste Stand nach
einem Fehler im Löschlauf schon der bereinigte.

Der Dump liegt auf demselben Rechner wie die Datenbank – das schützt gegen
Bedienfehler, nicht gegen Ausfall der Maschine. Ein Abzug auf ein zweites System
gehört dazu und ist hier bewusst nicht vorgegeben, weil er von der Umgebung des
Hauses abhängt.

## Wiederherstellung

```bash
./scripts/wiederherstellung.sh <dump-datei> [ziel-datenbank-url]
```

Prüft die Prüfsumme, fragt nach und ersetzt den Zielstand (`--clean`), statt ihn
zu überlagern – ein Mischzustand wäre später nicht mehr auseinanderzuhalten.

Nach der Wiederherstellung:

2. Anwendungsstand und Migrationsstand müssen zusammenpassen – im Zweifel den
   Code-Stand nehmen, der zum Dump gehört.
3. Healthcheck aufrufen, dann eine Anmeldung je Haus prüfen.

## Probelauf

**Eine Sicherung, die nie zurückgespielt wurde, ist eine Vermutung.**

```bash
./scripts/probelauf.sh
```

Der Lauf sichert, legt eine Wegwerf-Datenbank an, spielt zurück, vergleicht je
Haus die Zahl der Benutzer, Beiträge, Bestellungen, Tickets und Protokolleinträge
sowie die Liste der Migrationen – und räumt auf. Bei jeder Abweichung endet er
mit Code 1.

Der Vergleich zählt bewusst Zeilen und meldet nicht nur "Restore erfolgreich":
ein Dump kann durchlaufen und trotzdem halbe Tabellen enthalten.

Wann: monatlich, und nach jeder Änderung an Schema oder Sicherungsweg.

## Erprobungsumgebung befüllen

Ein Pilotsystem lebt von echten Datenmengen – aber nicht von echten Personen.

```bash
./scripts/sicherung.sh /tmp/uebernahme
./scripts/wiederherstellung.sh /tmp/uebernahme/<datei>.dump "postgresql://…/ahoi_pilot"
DATABASE_URL="postgresql://…/ahoi_pilot" node dist/scripts/anonymisieren.js --ja-diese-datenbank
```

Der letzte Schritt ersetzt jede Person durch eine **Kunstfigur**: erfundener,
aber stabiler Name, Kennung daraus abgeleitet, Adresse auf `.invalid` (reserviert,
also nie zustellbar), keine Telefonnummern. Rollen, Standort und Abteilung
bleiben – ohne sie ließen sich Freigabewege und Zielgruppen nicht erproben.
Benachrichtigungen, Lesebestätigungen und das Protokoll fallen weg.

Ohne `--ja-diese-datenbank` bricht das Skript ab und nennt die Datenbank, auf die
es zeigt. Ein versehentlicher Lauf gegen die Produktion wäre nicht rückgängig zu
machen.

**Die Grenze:** Freitexte bleiben stehen. Ein Ticket mit „Rückfrage an Frau
Meier" nennt eine Person, ohne dass ein Datenfeld darauf zeigt. Das Skript zählt
am Ende auf, wie viele Freitexte es gibt; durchsehen muss sie ein Mensch, bevor
die Umgebung Dritten offensteht.

## Aktualisierung

```bash
git pull
pnpm install
pnpm --filter @ah-intranet/shared build
./scripts/sicherung.sh                      # vor der Migration
pnpm --filter api prisma:migrate deploy
pnpm build
# Dienste neu starten
```

Die Sicherung vor der Migration ist der Rückweg. `prisma migrate deploy` wendet
nur vorhandene Migrationen an und erzeugt keine neuen – auf dem Server ist das
die einzige richtige Form.

## Störungen

| Bild                                      | Ursache                                 | Vorgehen                                                  |
| ----------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| `ok: false`, `database` rot               | Datenbank nicht erreichbar              | Postgres prüfen, Verbindungsgrenze, Plattenplatz          |
| Anmeldung scheitert überall nach Neustart | `JWT_SECRET` geändert                   | alte Sitzungen sind ungültig; einmal neu anmelden         |
| „Kein Autohaus zugeordnet"                | mehrere Häuser, keine Kennung angegeben | Kennung im Anmeldeformular oder eigene Domain hinterlegen |
| Modul liefert 404                         | Modul ist deaktiviert                   | Administration → Module                                   |
| „ohne Mandantenkontext"                   | Zugriff außerhalb einer Anfrage         | Programmfehler: `runWithTenant` fehlt (siehe `CLAUDE.md`) |

Der Fall „ohne Mandantenkontext" ist ein hart erzwungener Abbruch und kein
Betriebsproblem: er verhindert, dass eine Abfrage über alle Häuser läuft.

## Was bewusst fehlt

- **Kein automatischer Abzug auf ein zweites System.** Hängt von der Umgebung ab.
- **Keine Zeitsteuerung in der API.** Aufbewahrungs- und Sicherungslauf sind
  eigene Prozesse; bei mehreren API-Instanzen liefe eine eingebaute Steuerung
  mehrfach.
- **Keine zentrale Protokollauswertung.** Die Anwendung schreibt nach stdout –
  das Einsammeln ist Sache der Umgebung.
