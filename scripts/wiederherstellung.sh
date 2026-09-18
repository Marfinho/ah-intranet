#!/usr/bin/env bash
#
# Wiederherstellung einer Sicherung.
#
#   ./scripts/wiederherstellung.sh <dump-datei> [ziel-datenbank-url]
#
# Ohne zweites Argument wird in die Datenbank aus DATABASE_URL zurückgespielt -
# der bestehende Inhalt wird dabei ersetzt. Deshalb fragt das Skript nach, außer
# WIEDERHERSTELLUNG_JA=1 ist gesetzt (für den Probelauf).

set -euo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DUMP="${1:-}"
ZIEL_URL="${2:-}"

if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "Aufruf: $0 <dump-datei> [ziel-datenbank-url]" >&2
  exit 1
fi

if [[ -z "$ZIEL_URL" ]]; then
  if [[ -n "${DATABASE_URL:-}" ]]; then
    ZIEL_URL="$DATABASE_URL"
  elif [[ -f "$WURZEL/apps/api/.env" ]]; then
    ZIEL_URL="$(grep -E '^DATABASE_URL=' "$WURZEL/apps/api/.env" | head -1 | cut -d= -f2- | tr -d '"')"
  fi
fi
if [[ -z "$ZIEL_URL" ]]; then
  echo "Kein Ziel angegeben und DATABASE_URL ist nicht gesetzt." >&2
  exit 1
fi

# Prisma hängt `?schema=public` an die Verbindung - die Postgres-Werkzeuge lehnen
# diesen Parameter ab. Für sie bleibt nur der reine Verbindungsteil.
pg_url() {
  echo "${1%%\?*}"
}

if [[ -f "$DUMP.sha256" ]]; then
  echo "Prüfe Prüfsumme …"
  (cd "$(dirname "$DUMP")" && sha256sum --check --status "$(basename "$DUMP").sha256")
  echo "Prüfsumme in Ordnung."
else
  echo "Warnung: keine Prüfsumme neben der Sicherung gefunden." >&2
fi

ZIEL_ANZEIGE="$(echo "$ZIEL_URL" | sed -E 's#//[^@]*@#//***@#')"
if [[ "${WIEDERHERSTELLUNG_JA:-0}" != "1" ]]; then
  echo
  echo "Ziel: $ZIEL_ANZEIGE"
  echo "Der vorhandene Inhalt dieser Datenbank wird ERSETZT."
  read -r -p "Wirklich fortfahren? (ja/nein) " antwort
  [[ "$antwort" == "ja" ]] || { echo "Abgebrochen."; exit 1; }
fi

echo "Stelle wieder her …"
# --clean --if-exists: der Zielstand wird ersetzt, nicht überlagert. Ein
# Restore auf eine halb gefüllte Datenbank wäre sonst ein Mischzustand, den
# niemand mehr auseinanderhält.
pg_restore --dbname="$(pg_url "$ZIEL_URL")" --clean --if-exists --no-owner --no-privileges "$DUMP"

echo "Wiederherstellung abgeschlossen."
echo
echo "Nicht vergessen: INTEGRATION_SECRET_KEY muss derselbe sein wie zum"
echo "Zeitpunkt der Sicherung, sonst sind die Zugangsdaten zu Fremdsystemen"
echo "unlesbar. JWT_SECRET darf abweichen - dann müssen sich alle neu anmelden."
