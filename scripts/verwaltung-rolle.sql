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
-- Anlegen und Ändern gehören zur Verwaltung. Schreibbar, aber nie lesbar: `tokenHash`
-- (INSERT/UPDATE ohne SELECT) - ein neuer Link lässt sich setzen, ein bestehender nicht auslesen.
GRANT INSERT, DELETE ON "Lead" TO ahoi_verwaltung;
GRANT UPDATE (name, ansprechperson, notiz, status, "tokenHash", "tokenGueltigBis", "tokenWiderrufenAm", "anzahlHaeuser",
  "anzahlNutzer", "keyUser", tier, module, "kundenStandorte", "hausId", "updatedAt") ON "Lead" TO ahoi_verwaltung;
GRANT SELECT (id, "tenantId", "leadId", position, name, strasse, plz, ort, marken, leistungen, oeffnungszeiten, campus, vorschlag)
  ON "LeadStandort" TO ahoi_verwaltung;
GRANT INSERT, DELETE ON "LeadStandort" TO ahoi_verwaltung;
GRANT SELECT ("kundenStandorte") ON "Lead" TO ahoi_verwaltung;

-- -------------------------------------------------------- Betrieb
GRANT SELECT (migration_name, finished_at, rolled_back_at) ON _prisma_migrations TO ahoi_verwaltung;

-- ------------------------------------------------------ Haus anlegen
-- Die einzige Schreibberechtigung auf die Struktur eines Hauses ist diese
-- Funktion, kein INSERT auf Tabellen. Sie legt ausschließlich einen **neuen**
-- Mandanten samt allem an, was er zum Benutzen braucht (Rechte, Rollen, Standorte,
-- Abteilungen, Marken, Module, erstes Administrationskonto) - in einer
-- Transaktion, wie `TenantService.create` der Kunden-API. Ein bestehendes Haus
-- lässt sich damit nicht verändern: auch mit gestohlener Verwaltungsrolle
-- kommt niemand an die Konten eines laufenden Hauses.
--
-- Das Passwort kommt als bcrypt-Hash, nie im Klartext.

CREATE OR REPLACE FUNCTION public.verwaltung_haus_anlegen(p jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  t text := gen_random_uuid()::text;
  r jsonb; q jsonb; z jsonb; e jsonb;
  rid text; pid text; lid text; erster_standort text; erste_abt text; admin_rolle text;
  erster_code text;
BEGIN
  IF p #>> '{admin,passwordHash}' IS NULL OR p #>> '{admin,passwordHash}' NOT LIKE '$2%' THEN
    RAISE EXCEPTION 'Das Passwort des ersten Kontos muss als bcrypt-Hash übergeben werden';
  END IF;
  IF jsonb_array_length(p #> '{plan,standorte}') = 0 THEN
    RAISE EXCEPTION 'Ohne mindestens einen Standort lässt sich kein Haus anlegen';
  END IF;

  INSERT INTO "Tenant" (id, slug, name, domain, notes, "licensedSeats", "locationLimit", "updatedAt")
  VALUES (t, p ->> 'slug', p ->> 'name', NULLIF(p ->> 'domain', ''), NULLIF(p ->> 'notes', ''),
          (p ->> 'licensedSeats')::int, (p ->> 'locationLimit')::int, now());

  FOR r IN SELECT * FROM jsonb_array_elements(p -> 'permissions') LOOP
    INSERT INTO "Permission" (id, "tenantId", key, name, description, "updatedAt")
    VALUES (gen_random_uuid()::text, t, r ->> 'key', r ->> 'name', r ->> 'description', now());
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(p -> 'roles') LOOP
    rid := gen_random_uuid()::text;
    INSERT INTO "Role" (id, "tenantId", key, name, description, rank, "updatedAt")
    VALUES (rid, t, r ->> 'key', r ->> 'name', r ->> 'description', (r ->> 'rank')::int, now());
    FOR q IN SELECT * FROM jsonb_array_elements(r -> 'permissions') LOOP
      SELECT id INTO pid FROM "Permission" WHERE "tenantId" = t AND key = q #>> '{}';
      INSERT INTO "RolePermission" (id, "tenantId", "roleId", "permissionId") VALUES (gen_random_uuid()::text, t, rid, pid);
    END LOOP;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(p #> '{plan,marken}') LOOP
    INSERT INTO "Brand" (id, "tenantId", name, code, "updatedAt") VALUES (gen_random_uuid()::text, t, r ->> 'name', r ->> 'code', now());
  END LOOP;
  FOR r IN SELECT * FROM jsonb_array_elements(p #> '{plan,abteilungen}') LOOP
    INSERT INTO "Department" (id, "tenantId", name, code, "updatedAt") VALUES (gen_random_uuid()::text, t, r ->> 'name', r ->> 'code', now());
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(p #> '{plan,standorte}') LOOP
    lid := gen_random_uuid()::text;
    INSERT INTO "Location" (id, "tenantId", name, code, address, "updatedAt")
    VALUES (lid, t, r ->> 'name', r ->> 'code', r ->> 'adresse', now());
    IF erster_standort IS NULL THEN erster_standort := lid; erster_code := r ->> 'code'; END IF;
    FOR q IN SELECT * FROM jsonb_array_elements(r -> 'marken') LOOP
      INSERT INTO "LocationBrand" (id, "tenantId", "locationId", "brandId")
      SELECT gen_random_uuid()::text, t, lid, id FROM "Brand" WHERE "tenantId" = t AND code = q #>> '{}';
    END LOOP;
    FOR q IN SELECT * FROM jsonb_array_elements(r -> 'abteilungen') LOOP
      INSERT INTO "LocationDepartment" (id, "tenantId", "locationId", "departmentId")
      SELECT gen_random_uuid()::text, t, lid, id FROM "Department" WHERE "tenantId" = t AND code = q #>> '{}';
    END LOOP;
  END LOOP;

  IF p -> 'module' IS NOT NULL AND jsonb_typeof(p -> 'module') = 'array' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p -> 'module') LOOP
      INSERT INTO "ModuleSetting" ("tenantId", key, enabled, "updatedAt", "updatedBy")
      VALUES (t, r ->> 'key', (r ->> 'enabled')::boolean, now(), 'verwaltung');
    END LOOP;
  END IF;

  SELECT id INTO erste_abt FROM "Department" WHERE "tenantId" = t AND code = 'VWL';
  SELECT id INTO admin_rolle FROM "Role" WHERE "tenantId" = t AND key = 'admin';
  e := p -> 'admin';
  rid := gen_random_uuid()::text;
  INSERT INTO "User" (id, "tenantId", username, email, "passwordHash", "firstName", "lastName", "jobTitle",
                      "locationId", "departmentId", scopes, "mustChangePassword", "updatedAt")
  VALUES (rid, t, e ->> 'username', NULLIF(e ->> 'email', ''), e ->> 'passwordHash', e ->> 'firstName', e ->> 'lastName',
          'Administration', erster_standort, erste_abt, ARRAY['global', 'location:' || erster_code, 'department:VWL'], true, now());
  INSERT INTO "UserRole" (id, "tenantId", "userId", "roleId") VALUES (gen_random_uuid()::text, t, rid, admin_rolle);

  RETURN t;
END
$fn$;

REVOKE ALL ON FUNCTION public.verwaltung_haus_anlegen(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verwaltung_haus_anlegen(jsonb) TO ahoi_verwaltung;
