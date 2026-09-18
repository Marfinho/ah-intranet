#!/usr/bin/env bash
#
# Probelauf der Wiederherstellung.
#
# Eine Sicherung, die nie zurückgespielt wurde, ist eine Vermutung. Dieses Skript
# macht daraus eine Tatsache: es sichert, stellt in eine Wegwerf-Datenbank wieder
# her, vergleicht die Datenbestände je Haus und räumt auf.
#
#   ./scripts/probelauf.sh
#
# Gedacht für den regelmäßigen Lauf (monatlich) und nach jeder Änderung an
# Schema oder Sicherungsweg. Beendet sich mit Code 1, sobald etwas abweicht.

set -euo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROBE_DB="${PROBE_DB:-ah_intranet_probe}"

if [[ -z "${DATABASE_URL:-}" && -f "$WURZEL/apps/api/.env" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$WURZEL/apps/api/.env" | head -1 | cut -d= -f2- | tr -d '"')"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL ist nicht gesetzt." >&2
  exit 1
fi

# Verwaltungsverbindung auf postgres, um die Probedatenbank anlegen zu können.
BASIS="${DATABASE_URL%%\?*}"
SERVER="${BASIS%/*}"
VERWALTUNG="$SERVER/postgres"
PROBE_URL="$SERVER/$PROBE_DB"
# Für psql ohne Prismas `?schema=`-Parameter.
QUELLE="$BASIS"

aufraeumen() {
  psql "$VERWALTUNG" -q -c "DROP DATABASE IF EXISTS \"$PROBE_DB\";" >/dev/null 2>&1 || true
  rm -rf "$ARBEIT"
}
ARBEIT="$(mktemp -d)"
trap aufraeumen EXIT

echo "== 1. Sicherung anlegen =="
DUMP="$("$WURZEL/scripts/sicherung.sh" "$ARBEIT" | tail -1)"
echo

echo "== 2. Probedatenbank anlegen =="
psql "$VERWALTUNG" -q -c "DROP DATABASE IF EXISTS \"$PROBE_DB\";"
psql "$VERWALTUNG" -q -c "CREATE DATABASE \"$PROBE_DB\";"
echo "$PROBE_DB angelegt."
echo

echo "== 3. Wiederherstellen =="
WIEDERHERSTELLUNG_JA=1 "$WURZEL/scripts/wiederherstellung.sh" "$DUMP" "$PROBE_URL" | grep -v '^$'
echo

echo "== 4. Bestände vergleichen =="
# Je Mandant und Tabelle zählen. Ein Dump, der durchläuft, aber halbe Tabellen
# enthält, fiele bei einer reinen Erfolgsmeldung nicht auf.
ABFRAGE="
SELECT t.slug,
       (SELECT count(*) FROM \"User\" u WHERE u.\"tenantId\" = t.id)        AS benutzer,
       (SELECT count(*) FROM \"NewsPost\" n WHERE n.\"tenantId\" = t.id)    AS news,
       (SELECT count(*) FROM \"Order\" o WHERE o.\"tenantId\" = t.id)       AS bestellungen,
       (SELECT count(*) FROM \"Ticket\" k WHERE k.\"tenantId\" = t.id)      AS tickets,
       (SELECT count(*) FROM \"AuditLog\" a WHERE a.\"tenantId\" = t.id)    AS audit
FROM \"Tenant\" t ORDER BY t.slug;
"

psql "$QUELLE" -At -F'|' -c "$ABFRAGE" > "$ARBEIT/original.txt"
psql "$PROBE_URL"    -At -F'|' -c "$ABFRAGE" > "$ARBEIT/probe.txt"

printf '%-20s %9s %6s %13s %8s %6s\n' "Haus" "Benutzer" "News" "Bestellungen" "Tickets" "Audit"
while IFS='|' read -r slug rest; do
  printf '%-20s %9s %6s %13s %8s %6s\n' "$slug" $(echo "$rest" | tr '|' ' ')
done < "$ARBEIT/original.txt"
echo

if diff -q "$ARBEIT/original.txt" "$ARBEIT/probe.txt" >/dev/null; then
  echo "Bestände stimmen überein."
else
  echo "ABWEICHUNG zwischen Original und Wiederherstellung:" >&2
  diff "$ARBEIT/original.txt" "$ARBEIT/probe.txt" >&2 || true
  exit 1
fi

echo
echo "== 5. Schema prüfen =="
# Die Migrationsliste muss identisch sein, sonst passt der Anwendungsstand nicht
# zur wiederhergestellten Datenbank.
psql "$QUELLE" -At -c 'SELECT migration_name FROM _prisma_migrations ORDER BY migration_name;' > "$ARBEIT/mig-original.txt"
psql "$PROBE_URL"    -At -c 'SELECT migration_name FROM _prisma_migrations ORDER BY migration_name;' > "$ARBEIT/mig-probe.txt"

if diff -q "$ARBEIT/mig-original.txt" "$ARBEIT/mig-probe.txt" >/dev/null; then
  echo "$(wc -l < "$ARBEIT/mig-original.txt") Migrationen, identisch."
else
  echo "ABWEICHUNG im Migrationsstand:" >&2
  diff "$ARBEIT/mig-original.txt" "$ARBEIT/mig-probe.txt" >&2 || true
  exit 1
fi

echo
echo "Probelauf bestanden: die Sicherung lässt sich vollständig zurückspielen."
