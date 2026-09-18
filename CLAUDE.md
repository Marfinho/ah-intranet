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

## Mandantenfähigkeit

Das Intranet trägt mehrere Autohäuser auf einer Installation. Die Trennung
liegt **nicht** in der Disziplin des Fachcodes, sondern eine Ebene tiefer:

- Der Mandant der Anfrage steht in einem `AsyncLocalStorage`
  (`core/tenant-context.ts`), gesetzt von `TenantMiddleware` **vor** allen Guards.
- Eine Prisma-Middleware (`core/prisma.service.ts`, Logik in
  `core/tenant-isolation.ts`) hängt den Mandanten an jede Bedingung und jede
  Neuanlage. Fachcode führt `tenantId` nirgends mit.
- **Fail-closed:** ohne Mandantenkontext scheitert der Datenzugriff hart, statt
  über alle Häuser zu laufen. Abläufe, die das fachlich brauchen (Anmeldung,
  Mandantenverwaltung), markieren sich mit `runUnscoped`.
- Grenze der Methode: `$queryRaw` läuft ohne Modell durch die Middleware und ist
  ungefiltert. Rohabfragen müssen den Mandanten selbst filtern.
- **Plattformverwaltung ≠ Adminrolle.** `admin` verwaltet das eigene Haus;
  Häuser anlegen und sperren darf nur `isPlatformAdmin` (`@PlatformAdmin()`).
- Auflösung des Hauses: eigene Domain oder Subdomain, sonst die Kennung im
  Anmeldeformular. Nur bei genau einem Haus entfällt die Angabe.
- Ein neues Haus entsteht samt Rollen, Rechten und erstem Administrationskonto
  in einer Transaktion – ein halb eingerichteter Mandant wäre nicht benutzbar.

## Architekturprinzipien

- **Registries als einzige Quelle der Wahrheit.** Module stehen in
  `packages/shared/src/modules.ts`, Konnektoren in `connectors.ts`, Rollen und
  Rechte in `rbac.ts`, Aufbewahrungsfristen in `retention.ts`. Neue Einträge dort
  wirken ohne Migration in API und Oberfläche – und gelten für jedes Haus gleich.
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

## Datenschutz

- **Auskunft** (Art. 15) als Datei über **Administration → Datenschutz**.
- **Löschung** (Art. 17) als **Anonymisierung**: das Konto verliert seine
  Identität, bleibt aber Anker aufbewahrungspflichtiger Vorgänge. Hartes Löschen
  würde freigegebene Bestellungen mitreißen, die zehn Jahre bleiben müssen.
- **Fristen** in `packages/shared/src/retention.ts`, durchgesetzt von
  `src/scripts/aufbewahrung.ts` (Cron, nicht als Hintergrundaufgabe – bei
  mehreren API-Instanzen liefe die sonst mehrfach).
- **Grenze ehrlich benannt:** Freitexte können eine Person nennen, ohne dass ein
  Feld darauf zeigt. Die Auskunft führt diese Stellen auf, statt so zu tun, als
  sei das maschinell gelöst.
- Datenschutzfunktionen sind bewusst **kein abschaltbares Modul** – ein Schalter,
  der gesetzliche Pflichten entfernt, wäre ein Fehler im Entwurf.
- Einzelheiten und die Mitbestimmung nach § 87 BetrVG: [`docs/datenschutz.md`](docs/datenschutz.md).

## Bekannte Lücken

Erledigt sind inzwischen: CI-Pipeline, Unit-Tests, Linting, Rate-Limiting und
Kontosperre am Login, Session-Invalidierung, Healthcheck, Mandantenfähigkeit,
Datenschutzfunktionen.

Offen vor dem Produktivbetrieb:

- **Betrieb:** Sicherung und geprobte Wiederherstellung, Betriebsdokumentation.
- **Rohabfragen:** `$queryRaw` umgeht die Mandantentrennung (siehe oben).
- **Auftragsverarbeitungsvertrag** zwischen Betreiber und Haus (Vorlage fehlt).
