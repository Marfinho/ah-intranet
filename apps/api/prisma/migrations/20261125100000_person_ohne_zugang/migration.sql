-- Personen ohne Zugang: im Personalstamm, aber ohne Anmeldung.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "loginEnabled" BOOLEAN NOT NULL DEFAULT true;
