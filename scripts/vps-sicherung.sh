#!/usr/bin/env bash
#
# Sicherung der Datenbank auf einem Server mit docker-compose.prod.yml.
#
# sicherung.sh braucht eine erreichbare DATABASE_URL und pg_dump auf dem Rechner.
# Im Produktionsaufbau ist die Datenbank aber nur im Docker-Netz erreichbar - hier
# wird der Dump deshalb im Container erzeugt.
#
#   ./scripts/vps-sicherung.sh [zielverzeichnis]
#
# Legt Dump und Prüfsumme ab und räumt alte Sicherungen auf. vps-einrichten.sh
# trägt den täglichen Lauf ein.
#
# WICHTIG - zwei Grenzen:
# 1. Der Dump liegt auf DERSELBEN Maschine. Das schützt gegen Bedienfehler,
#    nicht gegen den Ausfall des Servers. Ein Abzug auf ein zweites System
#    gehört dazu und hängt von der Umgebung ab (CLAUDE.md, "Bekannte Lücken").
# 2. SECRET_KEY steht nicht im Dump. Ohne ihn sind hinterlegte Geheimnisse nach
#    einer Wiederherstellung unlesbar - /opt/ah-intranet/.env getrennt sichern.
set -euo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIEL="${1:-${SICHERUNG_ZIEL:-/var/backups/ahoi}}"
BEHALTEN="${SICHERUNG_BEHALTEN:-14}"
COMPOSE=(docker compose -f "$WURZEL/docker-compose.prod.yml" --project-directory "$WURZEL")

mkdir -p "$ZIEL"
chmod 700 "$ZIEL"
STEMPEL="$(date +%Y%m%d-%H%M%S)"
DATEI="$ZIEL/ah-intranet-$STEMPEL.dump"

echo "Sichere nach $DATEI" >&2
# Erst in eine Teildatei: bricht pg_dump ab, bleibt keine halbe Datei zurück, die
# beim Aufräumen für eine gute Sicherung gehalten würde.
"${COMPOSE[@]}" exec -T postgres pg_dump -U ahoi -d ah_intranet --format=custom --no-owner --no-privileges \
  </dev/null >"$DATEI.teil"

# Ein leerer oder winziger Dump ist ein Fehler, auch wenn pg_dump 0 meldet.
if [[ "$(stat -c %s "$DATEI.teil")" -lt 1024 ]]; then
  echo "Sicherung ist auffallend klein - abgebrochen." >&2
  rm -f "$DATEI.teil"
  exit 1
fi
mv "$DATEI.teil" "$DATEI"
(cd "$ZIEL" && sha256sum "$(basename "$DATEI")" >"$(basename "$DATEI").sha256")
echo "Fertig: $(du -h "$DATEI" | cut -f1)" >&2

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
