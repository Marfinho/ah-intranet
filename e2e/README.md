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
node e2e/smoke.js         # lädt alle 35 Seiten und meldet Render-Fehler
node e2e/flows.js         # 27 Prüfungen über die wichtigsten Fachprozesse
node e2e/integrations.js  # 20 Prüfungen der Schnittstellen und des Fahrzeugbestands
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

## Was `integrations.js` abdeckt

- Konnektorübersicht mit Verfügbarkeitsklassen
- Detailseite eines vertraglich gesperrten Systems (RW.IL)
- Zugangsdaten werden nie in die Oberfläche zurückgelesen
- Abgleich über mobile.de und Anzeige im Fahrzeugbestand
- Modulabhängigkeit Fahrzeugbestand → Schnittstellen

Für `integrations.js` müssen mobile.de (gegen Mock oder Sandbox) und der
DMS-Dateiaustausch konfiguriert sein, sonst bleibt der Bestand leer.

## Hinweis zum Zustand

Die Skripte verändern Daten (Bestellungen, Tickets, Module). `flows.js` setzt die
Module am Ende auf den Standard zurück; für wiederholbare Läufe empfiehlt sich
vorher `pnpm --filter api prisma:seed`.

## Konfiguration

| Variable         | Standard                 |
| ---------------- | ------------------------ |
| `E2E_BASE_URL`   | `http://localhost:3000`  |
| `E2E_PASSWORD`   | `Intranet2026!`          |
| `CHROMIUM_PATH`  | Playwright-Standardpfad  |
