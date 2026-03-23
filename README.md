# AH Intranet

Professionelles, responsives MVP-Intranet für ein Autohaus mit mehreren Standorten.

## Architektur

- **Monorepo mit pnpm-Workspace**
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** NestJS, TypeScript, Prisma ORM
- **Datenbank:** PostgreSQL
- **Auth:** Lokaler Login mit Benutzername + Passwort (Cookie-/Session-Vorbereitung)
- **Deployment:** Docker Compose für lokale Entwicklung und VPS-Betrieb
- **Architekturstil:** Modularer Monolith mit vorbereiteten Fachmodulen

## Struktur

```text
apps/
  api/   -> NestJS API
  web/   -> Next.js Intranet-Frontend
packages/
  shared/ -> gemeinsame Typen, Demo-Domänendaten und Selektoren
```

## Fachmodule im MVP

- `auth`
- `users`
- `roles_permissions`
- `news`
- `orders`
- `business_cards`
- `workwear`
- `approvals`
- `directory`
- `documents`
- `notifications`
- `calendar`
- `tickets`
- `onboarding`
- `admin`
- `audit`
- `order_cycles`

## MVP-Funktionen

- Dashboard mit Kennzahlen, priorisierten News, Benachrichtigungen und Freigaben
- News-Modul mit Zielgruppen- und Prioritätslogik
- Bestellmodule für Visitenkarten und Arbeitskleidung inklusive Kommentaren
- 1-stufiger Freigabeprozess mit separater externer Sammelbestellung
- Mitarbeiterverzeichnis / Telefonbuch
- Dokumenten- und Vorlagenzentrale
- Benachrichtigungszentrale
- Kalender für interne Termine, Schulungen und Wartungen
- Interne Serviceanfragen / Tickets
- Onboarding-Vorlagen für neue Mitarbeitende
- Adminbereich für Benutzer, Rollen, News, Formulare, Kataloge, Bestelltermine und Audit-Logs
- Seed-Daten und Demo-Domänendaten für UI-Abnahme und Tests

## Start lokal

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @ah-intranet/shared build
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate dev
pnpm --filter api prisma:seed
pnpm dev
```

Frontend: `http://localhost:3000`

Backend: `http://localhost:3001/api`

Hinweis: Das API-Paket konsumiert das Workspace-Paket `@ah-intranet/shared` als gebautes JavaScript aus `packages/shared/dist`. Sowohl `pnpm dev` als auch die einzelnen `api`- und `web`-Build-/Dev-Skripte bauen dieses Paket automatisch vor dem Start; zusätzlich startet `pnpm dev` einen Watcher für Änderungen an den Shared-Typen und Demo-Daten.

## Docker Compose

```bash
docker compose up --build
```

## Demo-Logins

- `admin / Start123!`
- `service.mitte / Start123!`
- `fachbereich / Start123!`

## Beispiel-Endpunkte

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/news`
- `GET /api/orders/overview`
- `GET /api/documents`
- `GET /api/notifications`
- `GET /api/calendar`
- `GET /api/tickets`
- `GET /api/onboarding`
- `GET /api/admin/summary`
- `GET /api/audit`
