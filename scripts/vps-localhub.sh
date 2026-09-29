#!/usr/bin/env bash
# Installiert LocalHub (https://github.com/Marfinho/triathlon-trainer) neben AHOI
# auf demselben Server, ohne KI-Anbindung, erreichbar unter
# https://localhub.<BASE_DOMAIN> über den Proxy von AHOI.
#
#   curl -fsSL https://raw.githubusercontent.com/Marfinho/ah-intranet/claude/lucid-pasteur-24oudc/scripts/vps-localhub.sh | bash
#
# Voraussetzung: vps-einrichten.sh ist gelaufen (Proxy, Netz ahoi-proxy).
# Erneut aufrufen aktualisiert den Code; Geheimnisse und Daten bleiben.
set -euo pipefail

# Bei `curl | bash` ist die Standardeingabe das Skript selbst - siehe
# vps-einrichten.sh. Docker-Aufrufe bekommen deshalb </dev/null.

DIR="${LOCALHUB_DIR:-/opt/localhub}"
AHOI_DIR="${AHOI_DIR:-/opt/ah-intranet}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte als root ausführen." >&2
  exit 1
fi
if [ ! -f "$AHOI_DIR/.env" ]; then
  echo "AHOI ist nicht eingerichtet ($AHOI_DIR/.env fehlt). Zuerst vps-einrichten.sh ausführen." >&2
  exit 1
fi
if ! docker network inspect ahoi-proxy >/dev/null 2>&1; then
  echo "Netz ahoi-proxy fehlt. vps-einrichten.sh erneut ausführen: es startet den Proxy in der aktuellen Fassung." >&2
  exit 1
fi

BASE="$(grep '^BASE_DOMAIN=' "$AHOI_DIR/.env" | cut -d= -f2-)"
HOST="localhub.$BASE"

RAM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
SWAP_MB="$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)"
echo "==> Arbeitsspeicher: ${RAM_MB} MB, Auslagerung: ${SWAP_MB} MB"
if [ $((RAM_MB + SWAP_MB)) -lt 4000 ]; then
  echo "Warnung: weniger als 4 GB RAM und Auslagerung zusammen - der Bau von LocalHub kann scheitern." >&2
fi

ufw allow 443/tcp >/dev/null 2>&1 || true

echo "==> LocalHub holen"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull -q --ff-only </dev/null
else
  git clone -q https://github.com/Marfinho/triathlon-trainer.git "$DIR"
fi
cd "$DIR"

echo "==> Konfiguration (.env)"
if [ ! -f .env ]; then
  {
    echo "POSTGRES_DB=localhub"
    echo "POSTGRES_USER=localhub"
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
    echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
    echo "CRON_SECRET=$(openssl rand -hex 32)"
    echo "SEED_ON_START=false"
    # Bewusst leer: ohne diese Schlüssel bleibt die KI-Anbindung aus und nur der
    # Copy-&-Paste-Weg aktiv. Ollama wird von der Compose-Datei gar nicht durchgereicht.
    echo "ANTHROPIC_API_KEY="
    echo "ANTHROPIC_MODEL="
    echo "OPENAI_API_KEY="
    echo "OPENAI_MODEL="
    # Ohne Domain nicht nutzbar (Google, Stripe, Intervals) - leer gelassen.
    for v in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET \
      STRIPE_PRICE_MONTHLY STRIPE_PRICE_YEARLY STRIPE_PRICE_LIFETIME \
      INTERVALS_ATHLETE_ID INTERVALS_API_KEY; do
      echo "$v="
    done
    echo "INTERVALS_API_BASE_URL=https://intervals.icu/api/v1"
  } >.env
  chmod 600 .env
fi
grep -v '^NEXTAUTH_URL=' .env >.env.neu || true
echo "NEXTAUTH_URL=https://$HOST" >>.env.neu
mv .env.neu .env
chmod 600 .env

# Eigene Ergänzung statt Änderung an der Compose-Datei des Projekts: Port 3000
# wird nicht veröffentlicht (Docker umgeht die Firewall, LocalHub wäre sonst
# unverschlüsselt von außen erreichbar), dafür hängt die App am Netz des Proxys.
cat >docker-compose.override.yml <<'Y'
services:
  app:
    ports: !reset []
    networks:
      - default
      - ahoi-proxy
    environment:
      # Hinter dem Proxy kommt der Host per Kopfzeile an; ohne dies weist
      # Auth.js die Anfrage als fremden Host ab.
      AUTH_TRUST_HOST: "true"

networks:
  ahoi-proxy:
    external: true
Y

echo "==> Bauen (dauert auf kleinen Servern einige Minuten)"
docker compose build app </dev/null
echo "==> Starten"
docker compose up -d </dev/null

echo
echo "Fertig."
echo "  LocalHub: https://$HOST"
echo "  Beim ersten Aufruf holt der Proxy das Zertifikat - das kann eine halbe Minute dauern."
echo "  Konto anlegen über die Registrierung auf der Startseite (E-Mail und Passwort)."
