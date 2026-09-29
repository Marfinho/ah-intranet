#!/usr/bin/env bash
# Richtet AHOI auf einem frischen Ubuntu-Server ein - ohne Domain, über sslip.io.
#
#   curl -fsSL https://raw.githubusercontent.com/Marfinho/ah-intranet/claude/lucid-pasteur-24oudc/scripts/vps-einrichten.sh | bash -s -- autohaus-x autohaus-y
#
# Die Argumente sind die Kennungen der Häuser, die erreichbar sein sollen
# (jede braucht einen Eintrag in FRONTEND_URL, sonst weist die API den Browser
# ab). Erneut aufrufen mit allen Kennungen, wenn ein Haus dazukommt: Geheimnisse
# bleiben erhalten, nur die Liste wird neu geschrieben.
#
# Gedacht für Umgebungen, in denen man nur eine Weboberfläche hat und kaum
# tippen will. Ohne TLS - nur für die Erprobung mit Testdaten (docs/vps.md).
set -euo pipefail

# Bei `curl | bash` ist die Standardeingabe das Skript selbst: jeder Befehl, der
# davon liest (docker compose exec), verschluckt den Rest und das Skript endet
# stumm mittendrin. Deshalb bekommen alle Docker-Aufrufe </dev/null.

BRANCH="${AHOI_BRANCH:-claude/lucid-pasteur-24oudc}"
DIR="${AHOI_DIR:-/opt/ah-intranet}"
COMPOSE="docker compose -f docker-compose.prod.yml"

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte als root ausführen." >&2
  exit 1
fi

echo "==> Grundpakete und Docker"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ufw openssl >/dev/null
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

# SSH zuerst freigeben: ohne diese Regel sperrt sich aus, wer ufw einschaltet.
echo "==> Firewall (SSH und Port 80)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw --force enable >/dev/null

echo "==> Anwendung holen ($BRANCH)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin "$BRANCH"
  git -C "$DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
else
  git clone -q -b "$BRANCH" https://github.com/Marfinho/ah-intranet.git "$DIR"
fi
cd "$DIR"

IP="$(curl -4 -fsS --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
BASE="$(echo "$IP" | tr . -).sslip.io"

# Ursprünge der Häuser (und der Plattformverwaltung) für die API.
ORIGINS="http://verwaltung.$BASE"
for haus in "$@"; do
  ORIGINS="$ORIGINS,http://$haus.$BASE"
done

echo "==> Konfiguration (.env)"
if [ ! -f .env ]; then
  {
    echo "DB_PASSWORD=$(openssl rand -hex 24)"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "SECRET_KEY=$(openssl rand -hex 32)"
    echo "PLATTFORM_PASSWORT=$(openssl rand -hex 8)Aa1"
  } >.env
  chmod 600 .env
fi
grep -v -E '^(BASE_DOMAIN|FRONTEND_URL)=' .env >.env.neu || true
{
  echo "BASE_DOMAIN=$BASE"
  echo "FRONTEND_URL=$ORIGINS"
} >>.env.neu
mv .env.neu .env
chmod 600 .env

echo "==> Bauen und starten (dauert einige Minuten)"
$COMPOSE up -d --build </dev/null

# Die API lauscht erst, wenn die Migrationen durch sind; vorher einzurichten
# könnte an fehlenden Tabellen scheitern und halb angelegt zurückbleiben.
echo "==> Warten auf die API"
bereit=0
for _ in $(seq 1 60); do
  if $COMPOSE exec -T api wget -q -O /dev/null http://localhost:3001/api/health </dev/null 2>/dev/null; then
    bereit=1
    break
  fi
  sleep 5
done
if [ "$bereit" -ne 1 ]; then
  echo "API antwortet nicht. Log ansehen mit: cd $DIR && $COMPOSE logs api" >&2
  exit 1
fi

echo "==> Plattformverwaltung einrichten"
$COMPOSE exec -T api pnpm --filter api prisma:einrichten </dev/null

PASSWORT="$(grep '^PLATTFORM_PASSWORT=' .env | cut -d= -f2-)"
echo
echo "Fertig."
echo "  Plattformverwaltung: http://verwaltung.$BASE   Benutzer: plattform   Passwort: $PASSWORT"
for haus in "$@"; do
  echo "  Haus:                http://$haus.$BASE"
done
echo "  Landingpage:         http://$BASE"
echo "Das Passwort steht auch in $DIR/.env (nur für root lesbar)."
