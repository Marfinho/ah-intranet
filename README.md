# AH Intranet

Responsives Intranet für Autohäuser mit mehreren Standorten. Vollständig
lauffähig: echte Anmeldung, Datenhaltung in PostgreSQL, 22 Fachmodule, die
sich vom Adminbereich einzeln ein- und ausschalten lassen. Eine Installation
trägt mehrere Autohäuser mit vollständig getrennten Daten.

## Architektur

- **Monorepo mit pnpm-Workspace**
- **Frontend:** Next.js 14 (App Router, Server Components, Server Actions), TypeScript, Tailwind CSS
- **Backend:** NestJS, TypeScript, Prisma ORM
- **Datenbank:** PostgreSQL
- **Auth:** Benutzername + Passwort, bcrypt-Hash, JWT im httpOnly-Cookie
- **Deployment:** Docker Compose für lokale Entwicklung und VPS-Betrieb

```text
apps/
  api/   -> NestJS API (Prisma, Guards, Fachlogik)
  web/   -> Next.js Intranet-Frontend
packages/
  shared/ -> gemeinsame Typen, Modul- und Konnektor-Registry
e2e/      -> browserbasierte Abnahmeprüfungen
docs/     -> Schnittstellendokumentation
```

## Start lokal

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

pnpm --filter @ah-intranet/shared build
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate deploy   # oder: prisma:migrate dev
pnpm --filter api prisma:seed

pnpm dev
```

Frontend: `http://localhost:3000` · Backend: `http://localhost:3001/api`

### Demokonten

Der Seed legt **zwei Autohäuser** an: `autohaus-mueller` und `autohaus-nord`.
Beide haben dieselben Benutzernamen – die Kennung im Anmeldeformular entscheidet,
in welches Haus die Anmeldung führt. Die Plattformverwaltung liegt bei `admin`
im Haus `autohaus-mueller`.

Alle Konten des Seeds nutzen dasselbe Passwort: **`Intranet2026!`**
(über `SEED_PASSWORD` überschreibbar).

| Benutzer    | Rolle(n)                         | Wofür geeignet                          |
| ----------- | -------------------------------- | --------------------------------------- |
| `admin`     | Administration                   | Modulsteuerung, Benutzer, Rollen, Audit |
| `s.meier`   | Fachbereichsadmin, Führungskraft | Freigaben, Bestellwesen, Abwesenheiten  |
| `t.neumann` | Fachbereichsadmin                | News, Marketing                         |
| `j.kruse`   | Führungskraft                    | Teamanträge freigeben                   |
| `p.hansen`  | Mitarbeitende                    | normale Nutzersicht                     |

## Modulsteuerung

Herzstück der Anwendung: unter **Administration → Module** lässt sich jedes
Fachmodul für das gesamte Intranet ein- und ausschalten.

- Die Registry in `packages/shared/src/modules.ts` ist die einzige Quelle der
  Wahrheit. Ein neues Modul wird dort eingetragen und taucht ohne Migration in
  API und Adminoberfläche auf.
- Ein abgeschaltetes Modul verschwindet aus der Navigation, seine Seiten leiten
  auf einen Hinweis um, und seine API-Routen antworten mit 404 – die Sperre gilt
  also auch für direkte Aufrufe, nicht nur für die Oberfläche.
- **Kernmodule** (Dashboard, Benachrichtigungen, Administration) sind gesperrt,
  damit das Intranet bedienbar bleibt.
- **Abhängigkeiten** werden mitgeführt: Wird _Bestellungen_ deaktiviert, gehen
  die _Freigaben_ automatisch mit. Vor dem Abschalten wird das angezeigt.
- Daten bleiben erhalten; ein Modul ist nur nicht mehr erreichbar.
- Jede Schaltung landet im Audit-Log.

Serverseitig sorgt der `ModuleEnabledGuard` dafür; der aktive Zustand wird im
Prozess gecacht (15 s TTL, sofortige Invalidierung beim Schalten), damit nicht
jeder Request einen zusätzlichen Datenbankzugriff auslöst.

## Fachmodule

| Gruppe        | Module                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Arbeitsplatz  | Dashboard\*, Globale Suche, Benachrichtigungen\*, Schnellzugriffe                                |
| Kommunikation | Aktuelles (News), Mitarbeiterverzeichnis, Umfragen, Ideenmanagement                              |
| Prozesse      | Dokumente, Wissensdatenbank, Bestellungen, Freigaben, Serviceanfragen, Onboarding, Abwesenheiten |
| Ressourcen    | Kalender, Raumbuchung, Fuhrpark, Fahrzeugbestand                                                 |
| Verwaltung    | Administration\*, Schnittstellen, Audit-Log                                                      |

\* Kernmodul, nicht abschaltbar.

### Was die Module können

- **News** – Zielgruppensteuerung über Scope-Tokens, Priorität, Anpinnen,
  Laufzeit, Lesebestätigung, Kommentare; hohe und kritische Beiträge lösen
  automatisch Benachrichtigungen an die betroffene Zielgruppe aus.
- **Bestellungen** – Visitenkarten mit serverseitig konfigurierbarem Formular
  und Arbeitskleidung aus einem gepflegten Katalog, jeweils mit Sammelbestell-
  terminen, Verlauf und Rückfragen.
- **Freigaben** – einstufiger Prozess mit geprüften Statusübergängen
  (`Eingereicht → Genehmigt → Vorgemerkt → Extern bestellt → Abgeschlossen`),
  Ablehnung, Stornierung und Sammelbestellung in einem Zug.
- **Serviceanfragen** – Tickets an IT, Facility, Personal, Marketing und
  Fuhrpark mit Zuweisung, Status und Verlauf.
- **Abwesenheiten** – Urlaub, Krankmeldung, Gleitzeit, Sonderurlaub und
  Fortbildung; Arbeitstage werden berechnet, Überschneidungen abgewiesen,
  Freigabe durch die Führungskraft, Urlaubskonto inklusive.
- **Onboarding** – rollenbasierte Vorlagen, Zuweisung an Personen, abhakbare
  Checkliste mit Fortschritt.
- **Raumbuchung / Fuhrpark** – Reservierungen mit Kollisionsprüfung; beim
  Fuhrpark zusätzlich Übergabestatus (reserviert, abgeholt, zurückgegeben).
- **Ideen / Umfragen** – Vorschläge mit Zustimmung und Bearbeitungsstand,
  Abstimmungen mit Auswertung in Echtzeit (eine Stimme pro Person, änderbar).
- **Wissensdatenbank / Dokumente** – durchsuchbare Artikel und verlinkte
  Unterlagen, beide mit Kategorien und Zielgruppen.
- **Globale Suche** – eine Abfrage über News, Dokumente, Wiki, Personen und
  Tickets; deaktivierte Module werden übersprungen.
- **Schnittstellen** – Konnektoren zu Konzernsystemen, DMS, Fahrzeugbörsen,
  Bewertung und Buchhaltung; siehe [`docs/schnittstellen.md`](docs/schnittstellen.md).
- **Fahrzeugbestand** – aus DMS-Export und mobile.de zusammengeführter Bestand.
- **Administration** – Benutzer (inkl. generiertem Startpasswort und Sperre),
  Rollen und Rechte, News, Dokumente, Kataloge, Formularfelder, Bestelltermine,
  Modulsteuerung und Audit-Log.

## Mandanten

Mehrere Autohäuser teilen sich eine Installation, ohne einander zu sehen.

- **Wo die Trennung liegt:** in einer Prisma-Middleware, nicht im Fachcode. Sie
  hängt den Mandanten an jede Bedingung und jede Neuanlage. Ein vergessener
  Filter in einem Service kann keine fremden Daten preisgeben.
- **Fail-closed:** ohne Mandantenkontext scheitert der Datenzugriff hart, statt
  über alle Häuser zu laufen.
- **Zuordnung:** eigene Domain (`intranet.autohaus-x.de`) oder Subdomain, sonst
  die Kennung im Anmeldeformular. Läuft nur ein Haus, entfällt die Angabe.
- **Plattformverwaltung:** unter **Administration → Autohäuser** legt der
  Betreiber Häuser an und sperrt sie. Das Recht dazu hängt an
  `isPlatformAdmin`, nicht an der Rolle `admin` – die gilt im eigenen Haus.
- Ein neues Haus entsteht samt Rollen, Rechten, Standort und erstem
  Administrationskonto in einem Schritt und ist sofort benutzbar.
- Gesperrt wird, nicht gelöscht: Anmeldungen scheitern sofort, die Daten bleiben
  für Aufbewahrungsfristen erhalten.

## Datenschutz

Unter **Administration → Datenschutz**:

- **Auskunft nach Art. 15 DSGVO** als Datei, die sich unverändert aushändigen
  lässt – samt Hinweis auf Freitexte, die maschinell nicht erfassbar sind.
- **Löschung nach Art. 17 DSGVO** als Anonymisierung: das Konto verliert seine
  Identität, aufbewahrungspflichtige Bestellungen und Freigaben bleiben erhalten
  (§ 147 AO, § 257 HGB). Rein persönliche Spuren werden wirklich entfernt.
- **Aufbewahrungsfristen** je Datenart mit Begründung, dazu eine Vorschau, was
  ein Lauf heute entfernen würde.

Der Aufräumlauf läuft per Cron:

```bash
pnpm --filter api aufbewahrung:vorschau   # zählt nur
pnpm --filter api aufbewahrung            # löscht
```

Verarbeitungsverzeichnis, Mitbestimmung nach § 87 BetrVG und die offenen Punkte:
[`docs/datenschutz.md`](docs/datenschutz.md).

## Rollen und Rechte

Vier Rollen mit aufsteigendem Rang: `mitarbeiter`, `fuehrungskraft`,
`fachbereichsadmin`, `admin`. Rollen tragen feingranulare Berechtigungen, die im
Adminbereich pflegbar sind. Die Rollenprüfung erfolgt serverseitig aus dem JWT –
nicht aus Anfragedaten.

**Zielgruppen** werden als flache Tokens abgebildet (`global`, `location:HB`,
`department:SRV`, `specialty:EMOB`). Eine einzige Array-Überlappungsabfrage auf
einem GIN-Index ersetzt mehrere Joins; Benutzer tragen ihre Tokens am Datensatz.

## Sicherheit

- Passwörter als bcrypt-Hash (Kostenfaktor 12); der Vergleich läuft auch bei
  unbekanntem Benutzernamen gegen einen Dummy-Hash, damit die Antwortzeit keine
  Konten verrät.
- JWT im httpOnly-Cookie, `sameSite=lax`, `secure` in Produktion.
- Global aktive Guards: Authentifizierung → Rollen → Modulaktivierung.
- CORS strikt auf `FRONTEND_URL` beschränkt, Cookies nur dorthin.
- Eingaben werden serverseitig validiert (`class-validator`,
  `forbidNonWhitelisted`); die Prüfung im Browser ist reiner Komfort.
- Audit-Log über alle relevanten Aktionen.
- Mandantentrennung auf Ebene des Datenzugriffs (siehe oben), nicht im Fachcode.

## Prüfungen

```bash
pnpm test                 # Unit-Tests (API und Shared)
node e2e/smoke.js         # alle 37 Seiten laden fehlerfrei
node e2e/flows.js         # 33 Prüfungen der Fachprozesse, inkl. Mandantentrennung
node e2e/integrations.js  # Prüfungen der Schnittstellen
```

Details in [`e2e/README.md`](e2e/README.md).

## Docker Compose

```bash
docker compose up --build
```

Startet PostgreSQL, API und Frontend. Migration und Seed danach einmalig:

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api npx tsx prisma/seed.ts
```

## Umgebungsvariablen

**`apps/api/.env`**

| Variable                 | Bedeutung                                             |
| ------------------------ | ----------------------------------------------------- |
| `PORT`                   | Port der API (Standard 3001)                          |
| `DATABASE_URL`           | PostgreSQL-Verbindung                                 |
| `FRONTEND_URL`           | erlaubte CORS-Herkunft, kommagetrennt möglich         |
| `JWT_SECRET`             | Sitzungsschlüssel – **in Produktion zwingend setzen** |
| `JWT_EXPIRES_IN`         | Gültigkeit des Tokens (Standard `12h`)                |
| `INTEGRATION_SECRET_KEY` | Verschlüsselt Zugangsdaten zu Fremdsystemen           |

**`apps/web/.env.local`**

| Variable              | Bedeutung                          |
| --------------------- | ---------------------------------- |
| `API_URL`             | serverseitig genutzte API-Adresse  |
| `NEXT_PUBLIC_API_URL` | Fallback, auch im Browser sichtbar |

Ohne `JWT_SECRET` startet die API bewusst nicht. Ohne `INTEGRATION_SECRET_KEY`
lassen sich keine Zugangsdaten zu Fremdsystemen speichern – ebenfalls Absicht.

## Schnittstellen

Anbindung an Konzernsysteme (RW.IL, DMS-Backbone, ElsaPro, ETKA, ODIS, Group
Retail Portal), DMS, Fahrzeugbörsen, Bewertung und Buchhaltung. Welche
Schnittstelle offen zugänglich ist und welche einen Partnervertrag braucht,
steht in [`docs/schnittstellen.md`](docs/schnittstellen.md).
