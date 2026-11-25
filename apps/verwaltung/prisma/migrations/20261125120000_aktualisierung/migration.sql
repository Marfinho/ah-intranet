
-- CreateEnum
CREATE TYPE "AktualisierungStatus" AS ENUM ('angefordert', 'laeuft', 'fertig', 'fehlgeschlagen', 'zurueckgerollt', 'abgebrochen');

-- CreateTable
CREATE TABLE "Aktualisierung" (
    "id" TEXT NOT NULL,
    "zielSha" TEXT NOT NULL,
    "vonSha" TEXT,
    "status" "AktualisierungStatus" NOT NULL DEFAULT 'angefordert',
    "betreiberId" TEXT,
    "betreiberName" TEXT NOT NULL,
    "angefordertAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gestartetAm" TIMESTAMP(3),
    "beendetAm" TIMESTAMP(3),
    "protokoll" TEXT NOT NULL DEFAULT '',
    "sicherung" TEXT,
    "meldung" TEXT,

    CONSTRAINT "Aktualisierung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AktualisiererStatus" (
    "id" INTEGER NOT NULL,
    "zuletztGesehen" TIMESTAMP(3) NOT NULL,
    "installierteSha" TEXT,
    "skriptVersion" TEXT,

    CONSTRAINT "AktualisiererStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Aktualisierung_status_idx" ON "Aktualisierung"("status");

-- CreateIndex
CREATE INDEX "Aktualisierung_angefordertAm_idx" ON "Aktualisierung"("angefordertAm");


-- Höchstens ein Auftrag zugleich: zwei Aktualisierungen, die sich gegenseitig
-- die Dateien unter den Füßen wegziehen, wären schlimmer als eine Wartezeit. Die
-- Datenbank entscheidet, nicht die Prüfung davor (zwei Klicks gleichzeitig).
CREATE UNIQUE INDEX "Aktualisierung_nur_ein_aktiver_Auftrag" ON "Aktualisierung" ((true)) WHERE status IN ('angefordert', 'laeuft');
