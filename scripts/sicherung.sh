#!/usr/bin/env bash
#
# Sicherung der Datenbank.
#
# Legt einen Dump im Custom-Format an (komprimiert, selektiv wiederherstellbar),
# schreibt eine Prüfsumme daneben und räumt alte Sicherungen auf.
#
#   ./scripts/sicherung.sh [zielverzeichnis]
#
# Erwartet DATABASE_URL in der Umgebung oder in apps/api/.env.
#
# WICHTIG: Ein Dump allein genügt nicht. Die Zugangsdaten zu Fremdsystemen sind
# mit INTEGRATION_SECRET_KEY verschlüsselt; ohne diesen Schlüssel sind sie nach
# einer Wiederherstellung unlesbar. Der Schlüssel gehört getrennt gesichert -
# getrennt deshalb, weil ein gestohlenes Backup sonst alles enthält.

set -euo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIEL="${1:-${SICHERUNG_ZIEL:-$WURZEL/backups}}"
BEHALTEN="${SICHERUNG_BEHALTEN:-14}"

if [[ -z "${DATABASE_URL:-}" && -f "$WURZEL/apps/api/.env" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$WURZEL/apps/api/.env" | head -1 | cut -d= -f2- | tr -d '"')"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL ist nicht gesetzt." >&2
  exit 1
fi

# Prisma hängt `?schema=public` an die Verbindung - die Postgres-Werkzeuge lehnen
# diesen Parameter ab. Für sie bleibt nur der reine Verbindungsteil.
pg_url() {
  echo "${1%%\?*}"
}

mkdir -p "$ZIEL"
STEMPEL="$(date +%Y%m%d-%H%M%S)"
DATEI="$ZIEL/ah-intranet-$STEMPEL.dump"

# Fortschritt auf stderr: die letzte Zeile auf stdout ist der Pfad, den
# aufrufende Skripte abgreifen.
echo "Sichere nach $DATEI" >&2
# --format=custom: komprimiert und erlaubt selektives Wiederherstellen einzelner
# Tabellen - bei einem versehentlich geleerten Modul Gold wert.
pg_dump --dbname="$(pg_url "$DATABASE_URL")" --format=custom --no-owner --no-privileges --file="$DATEI"

# Prüfsumme neben den Dump: eine stillschweigend beschädigte Sicherung ist
# schlimmer als keine, weil man sich auf sie verlässt.
sha256sum "$DATEI" > "$DATEI.sha256"

GROESSE="$(du -h "$DATEI" | cut -f1)"
echo "Fertig: $GROESSE" >&2

if [[ "$BEHALTEN" -gt 0 ]]; then
  ANZAHL="$(find "$ZIEL" -maxdepth 1 -name 'ah-intranet-*.dump' | wc -l)"
  if [[ "$ANZAHL" -gt "$BEHALTEN" ]]; then
    find "$ZIEL" -maxdepth 1 -name 'ah-intranet-*.dump' -printf '%T@ %p\n' |
      sort -n | head -n "$((ANZAHL - BEHALTEN))" | cut -d' ' -f2- |
      while read -r alt; do
        echo "Entferne alte Sicherung: $(basename "$alt")" >&2
        rm -f "$alt" "$alt.sha256"
      done
  fi
fi

echo "$DATEI"
