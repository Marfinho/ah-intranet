# Projektleitfaden AH Intranet

Kurzanleitung für alle, die an diesem Repository arbeiten – Menschen wie Agenten.

## Was das Projekt ist

Intranet für ein Autohaus mit mehreren Standorten und Konzernmarken.
pnpm-Monorepo: NestJS-API (`apps/api`), Next.js-Frontend (`apps/web`),
gemeinsame Typen und Registries (`packages/shared`).

## Mittelfristiges Ziel

**Das Intranet soll fachlich mehr leisten als die am Markt verfügbaren
Autohaus-Softwares.** Das ist ausdrücklich kein Auftrag für heute, sondern der
Maßstab, an dem **Architekturentscheidungen** gemessen werden. Konkret heißt das:

- Bei jeder Grundsatzentscheidung die Frage stellen, ob sie in zwei Jahren bei
  deutlich größerem Funktionsumfang noch trägt – nicht nur heute.
- Weichen, die später teuer umzubauen sind, früh richtig stellen:
  Mandantenfähigkeit, Berechtigungsmodell, Datenmodell, API-Verträge,
  Modulgrenzen, Ereignisse zwischen Modulen.
- Umgekehrt: **kein Vorbauen auf Verdacht.** Funktionen werden erst gebaut, wenn
  sie gebraucht werden. Der Anspruch gilt der Struktur, nicht dem Umfang.

Wenn eine Aufgabe eine dieser Weichen berührt, gehört die Abwägung in die
Antwort – auch wenn die Aufgabe selbst klein ist.

## Architekturprinzipien

- **Registries als einzige Quelle der Wahrheit.** Module stehen in
  `packages/shared/src/modules.ts`, Konnektoren in `connectors.ts`. Neue
  Einträge dort wirken ohne Migration in API und Oberfläche.
- **Serverseitige Durchsetzung.** Rollen kommen aus dem JWT, nie aus
  Anfragedaten. Prüfungen im Browser sind Komfort, nicht Sicherheit.
- **Guards in fester Reihenfolge:** Authentifizierung → Rollen →
  Modulaktivierung. Ein abgeschaltetes Modul antwortet mit 404, nicht 403.
- **Zielgruppen als flache Scope-Tokens** (`location:HB`, `department:SRV`)
  mit GIN-Index statt Join-Ketten.
- **Ehrlichkeit über erfundene Funktionalität.** Wo eine Spezifikation fehlt
  (z. B. vertraglich geschützte Herstellerschnittstellen), wird das benannt und
  der Vorgang sauber abgewiesen – keine geratenen Endpunkte.

## Stand der Module

22 Fachmodule, einzeln abschaltbar. **Schnittstellen** (`integrations`) und
**Fahrzeugbestand** (`stock`) sind derzeit **standardmäßig deaktiviert** – die
Anbindung an Fremdsysteme wurde zurückgestellt. Der Code bleibt vollständig
erhalten und lässt sich über die Modulsteuerung jederzeit zuschalten; Details in
[`docs/schnittstellen.md`](docs/schnittstellen.md).

## Arbeitsweise im Repository

```bash
pnpm typecheck    # alle Pakete
pnpm build        # alle Pakete
pnpm --filter api prisma:migrate dev --name <beschreibung>
pnpm --filter api prisma:seed
```

Nach Änderungen an `packages/shared` muss das Paket gebaut werden, bevor die API
typprüft: `pnpm --filter @ah-intranet/shared build`.

Browserprüfungen liegen in `e2e/` und brauchen laufende Dienste sowie ein
installiertes Playwright (siehe `e2e/README.md`).

## Konventionen

- Oberfläche, Fehlermeldungen, Commit-Botschaften und Kommentare auf Deutsch.
- Kommentare erklären das **Warum**, nicht das Was.
- Serverseitige Validierung mit `class-validator`, `forbidNonWhitelisted` aktiv.
- Jede fachlich relevante Aktion landet im Audit-Log.
- Geheimnisse gehören nie in die Antwort der API und nie unverschlüsselt in die
  Datenbank.

## Bekannte Lücken

Bevor das Intranet produktiv geht, fehlen noch: CI-Pipeline, automatisierte
Tests unterhalb der Browserebene, Linting, Rate-Limiting am Login,
Session-Invalidierung bei Kontosperre, aussagekräftiger Healthcheck,
Fehler- und Protokollauswertung, Backup- und Löschkonzept.
