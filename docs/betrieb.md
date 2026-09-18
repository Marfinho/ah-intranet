# Betrieb

Was zu tun ist, damit das Intranet läuft – und was zu tun ist, wenn es das nicht
tut.

## Überblick

| Teil      | Standard         | Prüfung                  |
| --------- | ---------------- | ------------------------ |
| API       | `:3001`, NestJS  | `GET /api/health`        |
| Frontend  | `:3000`, Next.js | `GET /login`             |
| Datenbank | PostgreSQL 16    | im Healthcheck enthalten |

Der Healthcheck prüft die Datenbankverbindung samt Antwortzeit und ob der
Schlüssel für die Zugangsdaten gesetzt ist. Er eignet sich als Ziel für einen
Monitor; ein `ok: false` ist ein Alarm, kein Hinweis.

## Umgebungsvariablen

| Variable                 | Bedeutung                                                 | Bei Verlust                                                    |
| ------------------------ | --------------------------------------------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`           | Verbindung zur Datenbank                                  | –                                                              |
| `JWT_SECRET`             | signiert die Sitzungen                                    | alle müssen sich neu anmelden                                  |
| `INTEGRATION_SECRET_KEY` | verschlüsselt Zugangsdaten zu Fremdsystemen (AES-256-GCM) | **Zugangsdaten sind unwiederbringlich** und neu zu hinterlegen |
| `FRONTEND_URL`           | erlaubte Herkunft für CORS und Cookies                    | –                                                              |

`INTEGRATION_SECRET_KEY` ist der kritische Wert. Er gehört **getrennt von den
Sicherungen** aufbewahrt – getrennt deshalb, weil ein gestohlenes Backup sonst
alles enthält, was es zum Auswerten braucht.

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

1. `INTEGRATION_SECRET_KEY` muss derselbe sein wie zum Zeitpunkt der Sicherung.
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

| Bild                                              | Ursache                                 | Vorgehen                                                       |
| ------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| `ok: false`, `database` rot                       | Datenbank nicht erreichbar              | Postgres prüfen, Verbindungsgrenze, Plattenplatz               |
| Anmeldung scheitert überall nach Neustart         | `JWT_SECRET` geändert                   | alte Sitzungen sind ungültig; einmal neu anmelden              |
| „Zugangsdaten konnten nicht entschlüsselt werden" | `INTEGRATION_SECRET_KEY` weicht ab      | richtigen Schlüssel setzen, sonst Zugangsdaten neu hinterlegen |
| „Kein Autohaus zugeordnet"                        | mehrere Häuser, keine Kennung angegeben | Kennung im Anmeldeformular oder eigene Domain hinterlegen      |
| Modul liefert 404                                 | Modul ist deaktiviert                   | Administration → Module                                        |
| „ohne Mandantenkontext"                           | Zugriff außerhalb einer Anfrage         | Programmfehler: `runWithTenant` fehlt (siehe `CLAUDE.md`)      |

Der Fall „ohne Mandantenkontext" ist ein hart erzwungener Abbruch und kein
Betriebsproblem: er verhindert, dass eine Abfrage über alle Häuser läuft.

## Was bewusst fehlt

- **Kein automatischer Abzug auf ein zweites System.** Hängt von der Umgebung ab.
- **Keine Zeitsteuerung in der API.** Aufbewahrungs- und Sicherungslauf sind
  eigene Prozesse; bei mehreren API-Instanzen liefe eine eingebaute Steuerung
  mehrfach.
- **Keine zentrale Protokollauswertung.** Die Anwendung schreibt nach stdout –
  das Einsammeln ist Sache der Umgebung.
