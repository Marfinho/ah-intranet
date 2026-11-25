#!/usr/bin/env bash
#
# Aktualisierer: führt aus, was die Verwaltung angefordert hat.
#
# Läuft jede Minute als root (cron) auf dem Server und tut zweierlei:
#   1. meldet sich in der Datenbank (Lebenszeichen, installierter Stand),
#   2. führt einen wartenden Auftrag aus: Hauptzweig von GitHub holen, sichern,
#      bauen, starten, prüfen - und bei Misserfolg auf den alten Stand zurück.
#
# Warum ein Skript auf dem Server und nicht die Verwaltung selbst: die
# Verwaltung ist ein Webdienst im Container. Dürfte sie Docker steuern, wäre sie
# der Schlüssel zum ganzen Server - jede Lücke in ihr wäre eine Lücke im Host.
# So bleibt sie ohne diese Rechte; sie legt nur einen Auftrag in die Datenbank,
# und dieses Skript entscheidet selbst, ob es ihn ausführt: es installiert nur
# einen Stand, der auf `main` liegt und dem installierten nachfolgt - was die
# Datenbank sonst behauptet, spielt dafür keine Rolle.
#
# Einrichtung: docs/verwaltung.md (Abschnitt „Aktualisieren“).
#
# Umgebung (für Tests und Sonderfälle):
#   AHOI_DIR      Verzeichnis der Installation (Standard: das des Skripts)
#   AHOI_PSQL     Befehl für psql (Standard: im postgres-Container)
#   AHOI_TROCKEN  1 = Docker-Schritte nur protokollieren, nichts bauen oder starten
#
# Der ganze Ablauf steht in main(): Bash liest ein Skript beim Ausführen
# stückweise. Ersetzt der Checkout dieses Skript mitten im Lauf, würde sonst
# an einer falschen Stelle weitergelesen. Eine Funktion wird als Ganzes gelesen.

SKRIPT_VERSION="1"

main() {
  set -uo pipefail
  local WURZEL
  WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  DIR="${AHOI_DIR:-$WURZEL}"
  TROCKEN="${AHOI_TROCKEN:-0}"
  ZWEIG="main"
  cd "$DIR" || exit 1

  COMPOSE=(docker compose -f "$DIR/docker-compose.prod.yml" --project-directory "$DIR")
  if [ -n "${AHOI_PSQL:-}" ]; then
    read -r -a PSQL <<<"$AHOI_PSQL"
  else
    PSQL=("${COMPOSE[@]}" exec -T postgres psql -U ahoi -d ah_intranet)
  fi
  LOGDATEI="${AHOI_LOG:-/var/log/ahoi-aktualisierung.log}"

  # Nur ein Lauf zugleich. Wer die Sperre hat, ist der einzige: ein Auftrag im
  # Zustand „läuft“ ist dann sicher verwaist (Neustart, abgebrochener Lauf).
  exec 9>"${AHOI_LOCK:-/var/lock/ahoi-aktualisierer.lock}"
  flock -n 9 || exit 0

  local installiert
  installiert="$(git rev-parse HEAD 2>/dev/null || true)"
  sql_still <<SQL || exit 0
INSERT INTO verwaltung."AktualisiererStatus" (id, "zuletztGesehen", "installierteSha", "skriptVersion")
VALUES (1, now(), '$installiert', '$SKRIPT_VERSION')
ON CONFLICT (id) DO UPDATE SET "zuletztGesehen" = now(), "skriptVersion" = '$SKRIPT_VERSION',
  "installierteSha" = COALESCE(verwaltung."AktualisiererStatus"."installierteSha", EXCLUDED."installierteSha");
SQL

  sql_still <<'SQL'
UPDATE verwaltung."Aktualisierung" SET status = 'fehlgeschlagen', "beendetAm" = now(),
  meldung = 'Unterbrochen: der Aktualisierer wurde mitten im Lauf beendet. Zustand der Installation prüfen (docs/verwaltung.md).'
WHERE status = 'laeuft';
SQL

  local zeile
  zeile="$(sql_wert "SELECT id || '|' || \"zielSha\" FROM verwaltung.\"Aktualisierung\" WHERE status = 'angefordert' ORDER BY \"angefordertAm\" LIMIT 1;")"
  [ -z "$zeile" ] && exit 0
  AUFTRAG="${zeile%%|*}"
  ZIEL="${zeile##*|}"

  # Annehmen: das Update mit Bedingung entscheidet, falls der Auftrag gerade zurückgezogen wurde.
  local angenommen
  angenommen="$(sql_wert "UPDATE verwaltung.\"Aktualisierung\" SET status = 'laeuft', \"gestartetAm\" = now(), \"vonSha\" = '$installiert' WHERE id = '$AUFTRAG' AND status = 'angefordert' RETURNING id;")"
  [ -z "$angenommen" ] && exit 0

  ALT="$installiert"
  ausfuehren
  exit $?
}

# ------------------------------------------------------------ Hilfen

sql_still() { "${PSQL[@]}" -q -v ON_ERROR_STOP=1 >/dev/null 2>&1; }
sql_wert() { printf '%s\n' "$1" | "${PSQL[@]}" -At -q -v ON_ERROR_STOP=1 2>/dev/null | head -n1; }

logge() {
  local zeile
  zeile="$(date '+%H:%M:%S') $*"
  echo "$zeile" >>"$LOGDATEI" 2>/dev/null || true
  echo "$zeile" >&2
  "${PSQL[@]}" -q -v ON_ERROR_STOP=1 -v z="$zeile" -v id="$AUFTRAG" >/dev/null 2>&1 <<'SQL' || true
UPDATE verwaltung."Aktualisierung" SET protokoll = protokoll || :'z' || E'\n' WHERE id = :'id';
SQL
}

abschluss() {
  # $1 Status, $2 Meldung
  "${PSQL[@]}" -q -v ON_ERROR_STOP=1 -v s="$1" -v m="$2" -v id="$AUFTRAG" -v sich="${SICHERUNG_DATEI:-}" >/dev/null 2>&1 <<'SQL' || true
UPDATE verwaltung."Aktualisierung" SET status = :'s'::verwaltung."AktualisierungStatus", meldung = :'m', "beendetAm" = now(),
  sicherung = NULLIF(:'sich', '') WHERE id = :'id';
SQL
}

# Docker-Aufrufe laufen hierüber: im Trockenlauf nur protokolliert.
dock() {
  if [ "$TROCKEN" = "1" ]; then
    logge "[Trockenlauf] $*"
    return 0
  fi
  "$@"
}

migrationen() {
  sql_wert "SELECT (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL) || '/' || (SELECT count(*) FROM verwaltung._prisma_migrations WHERE finished_at IS NOT NULL);"
}

warte_auf() {
  # $1 Dienst, $2 Adresse im Container
  local i
  [ "$TROCKEN" = "1" ] && { logge "[Trockenlauf] Warten auf $1 übersprungen"; return 0; }
  for i in $(seq 1 60); do
    if "${COMPOSE[@]}" exec -T "$1" wget -q -O /dev/null "$2" </dev/null 2>/dev/null; then
      return 0
    fi
    sleep 5
  done
  return 1
}

alle_gesund() {
  warte_auf api http://localhost:3001/api/health &&
    warte_auf verwaltung http://localhost:3002/api/health &&
    warte_auf web http://localhost:3000/login
}

# ------------------------------------------------------------ Ablauf

ausfuehren() {
  logge "Auftrag ${AUFTRAG:0:8}: Ziel ${ZIEL:0:7}, bisher ${ALT:0:7}"

  # --- Vorprüfungen: nichts anfassen, solange etwas nicht stimmt
  if ! [[ "$ZIEL" =~ ^[0-9a-f]{40}$ ]]; then
    logge "Ungültige Kennung des Zielstands."
    abschluss fehlgeschlagen "Ungültiger Zielstand."
    return 1
  fi
  local frei
  frei="$(df --output=avail -BM "${AHOI_DISK:-/var/lib/docker}" 2>/dev/null | tail -n1 | tr -dc '0-9')"
  [ -z "$frei" ] && frei="$(df --output=avail -BM "$DIR" | tail -n1 | tr -dc '0-9')"
  if [ "${frei:-0}" -lt "${AHOI_MIN_MB:-3000}" ]; then
    logge "Zu wenig Speicherplatz: ${frei:-?} MB frei, mindestens ${AHOI_MIN_MB:-3000} MB nötig."
    abschluss fehlgeschlagen "Zu wenig Speicherplatz (${frei:-?} MB frei). Nichts wurde verändert."
    return 1
  fi
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    logge "Das Installationsverzeichnis hat lokale Änderungen an versionierten Dateien:"
    git status --porcelain --untracked-files=no | head -n 10 | while read -r l; do logge "  $l"; done
    abschluss fehlgeschlagen "Lokale Änderungen im Installationsverzeichnis - nichts wurde verändert."
    return 1
  fi

  logge "Hole $ZWEIG von GitHub"
  if ! git fetch -q origin "$ZWEIG" 2>>"$LOGDATEI"; then
    abschluss fehlgeschlagen "GitHub nicht erreichbar (git fetch). Nichts wurde verändert."
    return 1
  fi
  # Der Aktualisierer glaubt nicht, was die Datenbank sagt: installiert wird nur,
  # was wirklich auf main liegt und dem laufenden Stand folgt.
  if ! git cat-file -e "$ZIEL^{commit}" 2>/dev/null; then
    abschluss fehlgeschlagen "Der Zielstand existiert nicht im Repository."
    return 1
  fi
  if ! git merge-base --is-ancestor "$ZIEL" "origin/$ZWEIG"; then
    logge "Der Zielstand liegt nicht auf $ZWEIG - abgelehnt."
    abschluss fehlgeschlagen "Der Zielstand liegt nicht auf $ZWEIG. Nichts wurde verändert."
    return 1
  fi
  if [ -n "$ALT" ] && ! git merge-base --is-ancestor "$ALT" "$ZIEL"; then
    logge "Der Zielstand folgt dem installierten nicht - abgelehnt."
    abschluss fehlgeschlagen "Der Zielstand ist nicht neuer als der installierte. Nichts wurde verändert."
    return 1
  fi
  if [ "$ALT" = "$ZIEL" ]; then
    abschluss fertig "Dieser Stand war bereits installiert."
    return 0
  fi

  local geaendert
  geaendert="$(git diff --name-only "$ALT" "$ZIEL")"
  logge "$(echo "$geaendert" | grep -c .) Dateien ändern sich"
  hat() { echo "$geaendert" | grep -qE "$1"; }

  # --- Sicherung: der Weg zurück für die Daten
  if [ "${AHOI_OHNE_SICHERUNG:-0}" != "1" ]; then
    logge "Sichere die Datenbank"
    if SICHERUNG_DATEI="$(SICHERUNG_ZIEL="${AHOI_SICHERUNG_ZIEL:-/var/backups/ahoi}" "$DIR/scripts/vps-sicherung.sh" 2>>"$LOGDATEI" | tail -n1)" && [ -n "$SICHERUNG_DATEI" ]; then
      logge "Sicherung: $SICHERUNG_DATEI"
    else
      SICHERUNG_DATEI=""
      logge "Sicherung fehlgeschlagen - Abbruch, nichts wurde verändert."
      abschluss fehlgeschlagen "Die Sicherung vor dem Update ist fehlgeschlagen. Nichts wurde verändert."
      return 1
    fi
  fi

  # --- Rückfallebene für die Images: der laufende Stand bekommt ein zweites Etikett
  local dienst
  for dienst in api web verwaltung; do
    dock docker tag "ahoi-$dienst:prod" "ahoi-$dienst:vorher" 2>/dev/null || true
  done
  local migr_vorher
  migr_vorher="$(migrationen)"

  # --- Neuer Stand
  logge "Wechsle auf ${ZIEL:0:7}"
  if ! git checkout -q -B "$ZWEIG" "$ZIEL" 2>>"$LOGDATEI"; then
    zurueck "Checkout fehlgeschlagen" "$migr_vorher"
    return 1
  fi

  # Nur bauen, was sich geändert hat - der Bau dauert auf kleinen Servern lange.
  # Gemeinsame Pakete und die Abhängigkeiten betreffen alle Dienste.
  local gemeinsam='^(packages/|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|package\.json$)'
  for dienst in api web verwaltung; do
    if hat "^apps/$dienst/" || hat "$gemeinsam" || ! docker image inspect "ahoi-$dienst:prod" >/dev/null 2>&1; then
      [ "$TROCKEN" = "1" ] && { logge "[Trockenlauf] Bau von $dienst"; continue; }
      logge "Baue $dienst"
      if ! "${COMPOSE[@]}" build "$dienst" </dev/null >>"$LOGDATEI" 2>&1; then
        zurueck "Der Bau von $dienst ist fehlgeschlagen (Details: $LOGDATEI)" "$migr_vorher"
        return 1
      fi
    else
      logge "$dienst unverändert - kein Neubau"
    fi
  done

  # Die Datenbankrolle der Verwaltung vor dem Start: der neue Code kann Rechte brauchen, die sie noch nicht hat.
  local pw
  pw="$(grep -E '^VERWALTUNG_DB_PASSWORD=' "$DIR/.env" 2>/dev/null | head -n1 | cut -d= -f2-)"
  if [ -n "$pw" ] && [[ "$pw" != *"'"* ]] && [ -f "$DIR/scripts/verwaltung-rolle.sql" ]; then
    logge "Spiele die Datenbankrolle der Verwaltung ein"
    if ! "${PSQL[@]}" -q -v ON_ERROR_STOP=1 -v passwort="'$pw'" <"$DIR/scripts/verwaltung-rolle.sql" >>"$LOGDATEI" 2>&1; then
      zurueck "Die Datenbankrolle der Verwaltung ließ sich nicht einspielen" "$migr_vorher"
      return 1
    fi
  else
    logge "Hinweis: VERWALTUNG_DB_PASSWORD fehlt oder ist ungeeignet - die Datenbankrolle wurde nicht eingespielt."
  fi

  logge "Starte die Dienste (Migrationen laufen beim Start)"
  if ! dock "${COMPOSE[@]}" up -d </dev/null >>"$LOGDATEI" 2>&1; then
    zurueck "docker compose up ist fehlgeschlagen" "$migr_vorher"
    return 1
  fi
  # Eine Einzeldatei als Bind-Mount behält nach dem Checkout ihre alte Fassung (neue Inode).
  if hat '^Caddyfile'; then
    logge "Proxy-Konfiguration geändert - starte den Proxy neu"
    dock "${COMPOSE[@]}" restart proxy </dev/null >>"$LOGDATEI" 2>&1 || true
  fi

  logge "Warte auf die Dienste"
  if ! alle_gesund; then
    zurueck "Ein Dienst wurde nach dem Update nicht gesund" "$migr_vorher"
    return 1
  fi

  "${PSQL[@]}" -q -v ON_ERROR_STOP=1 -v sha="$ZIEL" >/dev/null 2>&1 <<'SQL' || true
UPDATE verwaltung."AktualisiererStatus" SET "installierteSha" = :'sha' WHERE id = 1;
SQL
  dock docker image prune -f >/dev/null 2>&1 || true
  logge "Fertig: ${ZIEL:0:7} läuft"
  abschluss fertig "Aktualisiert auf ${ZIEL:0:7}."
  return 0
}

# Zurück auf den alten Stand. Datenbankmigrationen gehen nur vorwärts: wurden
# welche angewendet, läuft der alte Code gegen das neue Schema. Das ist meist
# verträglich, aber nicht garantiert - deshalb sagt die Meldung es offen und
# nennt die Sicherung.
zurueck() {
  local grund="$1" migr_vorher="$2" migr_nachher dienst
  logge "FEHLER: $grund"
  logge "Gehe zurück auf ${ALT:0:7}"
  git checkout -q --detach "$ALT" 2>>"$LOGDATEI"
  for dienst in api web verwaltung; do
    dock docker tag "ahoi-$dienst:vorher" "ahoi-$dienst:prod" 2>/dev/null || true
  done
  dock "${COMPOSE[@]}" up -d --no-build </dev/null >>"$LOGDATEI" 2>&1 || true

  migr_nachher="$(migrationen)"
  local hinweis=""
  if [ "$migr_vorher" != "$migr_nachher" ]; then
    hinweis=" ACHTUNG: Datenbankmigrationen wurden bereits angewendet ($migr_vorher -> $migr_nachher). Läuft der alte Stand nicht, die Sicherung einspielen: ${SICHERUNG_DATEI:-<keine Sicherung>} (scripts/wiederherstellung.sh)."
    logge "$hinweis"
  fi
  if alle_gesund; then
    abschluss zurueckgerollt "$grund. Der alte Stand ${ALT:0:7} läuft wieder.$hinweis"
  else
    logge "Auch der alte Stand wird nicht gesund. MANUELL EINGREIFEN: cd $DIR && docker compose -f docker-compose.prod.yml logs"
    abschluss fehlgeschlagen "$grund. Der Rückweg auf ${ALT:0:7} ist ebenfalls fehlgeschlagen - MANUELL EINGREIFEN.$hinweis"
  fi
}

main "$@"
exit $?
