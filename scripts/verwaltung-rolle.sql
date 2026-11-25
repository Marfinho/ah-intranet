-- Datenbankrolle der Verwaltung (apps/verwaltung).
--
-- Die Verwaltung sieht über alle Häuser hinweg nur Zahlen. Dass sie keine
-- Personendaten liest, ist hier festgeschrieben und nicht dem Wohlverhalten
-- des Programmcodes überlassen: die Rolle bekommt SELECT nur auf Spalten ohne
-- Personenbezug. Ein Fehler in einer Abfrage kann deshalb weder Namen noch
-- Mailadressen, Passwort-Hashes, Texte noch Abwesenheitsarten preisgeben -
-- die Datenbank lehnt es ab. Solange kein Auftragsverarbeitungsvertrag mit
-- einem Haus besteht, ist genau das die Voraussetzung (siehe docs/datenschutz.md).
--
-- Aufruf (als Datenbankbesitzer, einmal je Installation und nach neuen Tabellen):
--   psql "$DATABASE_URL" -v passwort="'…'" -f scripts/verwaltung-rolle.sql
--
-- Danach in der Verwaltung: INTRANET_DATABASE_URL=postgresql://ahoi_verwaltung:…@…/ah_intranet?schema=public

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ahoi_verwaltung') THEN
    CREATE ROLE ahoi_verwaltung LOGIN;
  END IF;
END $$;
ALTER ROLE ahoi_verwaltung PASSWORD :passwort;

-- Alles zurücknehmen, dann gezielt gewähren: so bleibt die Datei die vollständige Liste.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ahoi_verwaltung;
GRANT USAGE ON SCHEMA public TO ahoi_verwaltung;
-- Statistiken des Datenbankservers (Verbindungen, Zwischenspeicher) - ohne Dateninhalte.
GRANT pg_monitor TO ahoi_verwaltung;

-- ------------------------------------------------------------ Häuser
-- Das Logo (Bytes) bleibt außen vor.
GRANT SELECT (id, slug, name, domain, "isActive", "licensedSeats", "locationLimit", "mfaPflicht", notes, "createdAt", "updatedAt")
  ON "Tenant" TO ahoi_verwaltung;
GRANT UPDATE ("isActive", "licensedSeats", "locationLimit", notes, "updatedAt") ON "Tenant" TO ahoi_verwaltung;

GRANT SELECT (key, enabled, "updatedAt", "updatedBy", "tenantId") ON "ModuleSetting" TO ahoi_verwaltung;
GRANT INSERT ON "ModuleSetting" TO ahoi_verwaltung;
GRANT UPDATE (enabled, "updatedAt", "updatedBy") ON "ModuleSetting" TO ahoi_verwaltung;

GRANT SELECT (id, "tenantId", kind, "isActive") ON "TenantAuthProvider" TO ahoi_verwaltung;

-- ------------------------------------------------------------ Konten
-- Nur Zustand und Zeitpunkte: weder Benutzername noch Name, Mail oder Hash.
GRANT SELECT (id, "tenantId", status, "isPlatformAdmin", "lastLoginAt", "totpEnabledAt", "createdAt") ON "User" TO ahoi_verwaltung;
GRANT SELECT (id, "tenantId", name, code) ON "Location" TO ahoi_verwaltung;

-- Das Protokoll eines Hauses nur als Zählwert und Art der Aktion, nie Text oder Person.
GRANT SELECT ("tenantId", action, "createdAt") ON "AuditLog" TO ahoi_verwaltung;

-- ------------------------------------------------------- Nutzung (nur Zählen)
GRANT SELECT (id, "tenantId", "createdAt") ON
  "NewsPost", "Document", "WikiArticle", "CalendarEvent", "RoomBooking", "Idea", "Poll", "OnboardingAssignment",
  "Absence", "Shift", "CustodyItem", "MealOrder"
  TO ahoi_verwaltung;
GRANT SELECT (id, "tenantId", status, "createdAt", "completedAt") ON "Order" TO ahoi_verwaltung;
GRANT SELECT (id, "tenantId", status, "createdAt", "closedAt") ON "Ticket" TO ahoi_verwaltung;

-- ------------------------------------------------------ Interessenten
-- Gehören dem Betreiber selbst. Der Linkhash bleibt unlesbar: auch eine
-- gestohlene Verwaltungsrolle kann keine Pitch-Seite aufrufen.
GRANT SELECT (id, "tenantId", name, ansprechperson, notiz, status, "tokenGueltigBis", "tokenWiderrufenAm", "anzahlHaeuser",
  "anzahlNutzer", "keyUser", tier, module, "angefragtAm", "hausId", angebot, "preislisteVersion", "createdAt", "updatedAt")
  ON "Lead" TO ahoi_verwaltung;
GRANT UPDATE (status, notiz, "tokenWiderrufenAm", "updatedAt") ON "Lead" TO ahoi_verwaltung;
GRANT SELECT (id, "leadId", position, name, strasse, plz, ort, marken, leistungen, campus) ON "LeadStandort" TO ahoi_verwaltung;

-- -------------------------------------------------------- Betrieb
GRANT SELECT (migration_name, finished_at, rolled_back_at) ON _prisma_migrations TO ahoi_verwaltung;
