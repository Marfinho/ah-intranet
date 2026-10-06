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
apt-get install -y -qq git curl ufw openssl cron >/dev/null
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

# SSH zuerst freigeben: ohne diese Regel sperrt sich aus, wer ufw einschaltet.
echo "==> Firewall (SSH, Port 80 und 443)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

# Kleine Server gehen beim Bauen von Next.js in die Knie: ohne Auslagerung
# beendet der Kernel den Bau, mit zu wenig Speicher dazu kriecht er stundenlang.
# Deshalb Auslagerungsdatei anlegen, wenn kaum RAM da ist und keine besteht.
RAM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
echo "==> Arbeitsspeicher: ${RAM_MB} MB"
if [ "$RAM_MB" -lt 4000 ] && [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  echo "==> Lege 4 GB Auslagerung an"
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

echo "==> Anwendung holen ($BRANCH)"
ALT=""
if [ -d "$DIR/.git" ]; then
  ALT="$(git -C "$DIR" rev-parse HEAD)"
  git -C "$DIR" fetch -q origin "$BRANCH"
  git -C "$DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
else
  git clone -q -b "$BRANCH" https://github.com/Marfinho/ah-intranet.git "$DIR"
fi
cd "$DIR"

# Tägliche Sicherung, solange keine bessere eingerichtet ist. Sie liegt auf
# derselben Maschine (siehe vps-sicherung.sh) - ein Abzug auf ein zweites
# System bleibt Aufgabe des Betreibers.
echo "0 3 * * * root $DIR/scripts/vps-sicherung.sh >>/var/log/ahoi-sicherung.log 2>&1" >/etc/cron.d/ahoi-sicherung
chmod 644 /etc/cron.d/ahoi-sicherung

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

# Nur neu bauen, wenn sich Code geändert hat: der Bau dauert auf kleinen Servern
# sehr lange, und Änderungen an Konfiguration oder Skripten brauchen ihn nicht.
# Fehlt ein Image, baut `up` es ohnehin.
if [ -n "$ALT" ] && git diff --quiet "$ALT" HEAD -- apps packages pnpm-lock.yaml pnpm-workspace.yaml package.json; then
  echo "==> Code unverändert - kein Neubau"
else
  # Nacheinander statt gleichzeitig: zwei Bauvorgänge teilen sich sonst den knappen Speicher.
  echo "==> Bauen (Web und API nacheinander)"
  $COMPOSE build api </dev/null
  $COMPOSE build web </dev/null
fi
echo "==> Starten"
$COMPOSE up -d </dev/null

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
