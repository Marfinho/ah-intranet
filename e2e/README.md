# End-to-End-Prüfungen

Zwei Skripte, die die laufende Anwendung mit einem echten Browser bedienen.
Sie brauchen keinen Testrunner, nur `playwright` und gestartete Dienste.

## Voraussetzungen

```bash
# API auf :3001 und Web auf :3000 müssen laufen, die Datenbank frisch geseedet:
pnpm --filter api prisma:seed
pnpm dev
```

```bash
npm i playwright            # einmalig, außerhalb des Workspaces genügt
npx playwright install chromium
```

Ist Chromium bereits vorhanden (z. B. `PLAYWRIGHT_BROWSERS_PATH`), kann der Pfad
über `CHROMIUM_PATH` gesetzt werden.

## Ausführen

```bash
node e2e/smoke.js         # lädt alle 32 Seiten und meldet Render-Fehler
node e2e/flows.js         # 33 Prüfungen über die wichtigsten Fachprozesse
node e2e/einrichtung.js   # Ersteinrichtungs-Assistent: Admin-Flow eines neuen Hauses
```

Alle Skripte beenden sich mit Exit-Code 1, sobald eine Prüfung fehlschlägt.

## Was `flows.js` abdeckt

- Anmeldung, Abweisung falscher Zugangsdaten, Abmeldung
- Rollenabhängige Navigation und Schutz der Adminrouten
- Visitenkartenbestellung anlegen und in der eigenen Liste wiederfinden
- Serviceanfrage anlegen
- Serverseitige Validierung (Enddatum vor Startdatum)
- Abstimmen über eine Idee
- Modul deaktivieren, Route und Navigation prüfen, Abhängigkeitskaskade
- Zurücksetzen aller Module auf den Auslieferungszustand
- Freigabe einer Bestellung durch den Fachbereich
- News veröffentlichen und in der Übersicht sehen
- Globale Suche über mehrere Module
- Audit-Log auf protokollierte Aktionen
- Mandantentrennung: Anmeldung im zweiten Haus, getrennte Inhalte, Schutz der
  Mandantenverwaltung

## Was `einrichtung.js` abdeckt

Legt über die Plattformverwaltung ein frisches Haus an und durchläuft als dessen
erste Administration den Ersteinrichtungs-Assistenten: Willkommensdialog,
Mandantenprofil, erster Standort, erste Mitarbeiterin, erste News - und prüft,
dass sich der Fortschritt im Dashboard live aktualisiert und über "Mein Profil"
jederzeit erneut aufrufbar bleibt. Legt dabei ein neues Haus mit eindeutiger,
zeitstempelbasierter Kennung an; wiederholte Läufe kollidieren daher nicht.

## Hinweis zum Zustand

Die Skripte verändern Daten (Bestellungen, Tickets, Module). `flows.js` setzt die
Module am Ende auf den Standard zurück; für wiederholbare Läufe empfiehlt sich
vorher `pnpm --filter api prisma:seed`.

## Konfiguration

| Variable        | Standard                    |
| --------------- | --------------------------- |
| `E2E_BASE_URL`  | `http://localhost:3000`     |
| `E2E_API_URL`   | `http://localhost:3001/api` |
| `E2E_PASSWORD`  | `Intranet2026!`             |
| `E2E_TENANT`    | `autohaus-mueller`          |
| `E2E_TENANT_B`  | `autohaus-nord`             |
| `CHROMIUM_PATH` | Playwright-Standardpfad     |

## Mandanten

Der Seed legt zwei Autohäuser mit identischen Benutzernamen an. Deshalb geben
alle Skripte die Kennung bei der Anmeldung mit; ohne sie weist die API die
Anmeldung zu Recht ab. `flows.js` prüft die Trennung zusätzlich im Browser:
Kopfzeile, getrennte Beiträge und der Schutz der Mandantenverwaltung.
