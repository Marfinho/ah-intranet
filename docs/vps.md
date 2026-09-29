# Auf einen einzelnen Server (ohne Domain)

Für die Erprobung auf einem frischen Ubuntu 24.04. Ohne eigene Domain dient
**sslip.io**: `<haus>.217-160-128-156.sslip.io` löst von selbst auf die IP
`217.160.128.156` auf. Die erste Namensstufe ist die Kennung des Hauses.

**Grenze:** Ohne TLS läuft alles unverschlüsselt über HTTP, auch Passwörter.
Das genügt für die Erprobung mit Testdaten – **nicht** für echte Personendaten.
Dafür braucht es eine eigene Domain und Zertifikate (siehe `ausrollen.md`).

## 1. Server vorbereiten

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80/tcp && ufw --force enable
```

Docker umgeht `ufw` bei veröffentlichten Ports; deshalb veröffentlicht die
Compose-Datei nur den Proxy (Port 80), Datenbank und API bleiben intern.
Empfehlenswert: SSH-Schlüssel statt Kennwort und das Initialkennwort ändern.

## 2. Anwendung holen und konfigurieren

```bash
git clone https://github.com/Marfinho/ah-intranet.git && cd ah-intranet
cp .env.prod.example .env
nano .env        # DB_PASSWORD, JWT_SECRET, SECRET_KEY, PLATTFORM_PASSWORT
```

Zufallswerte: `openssl rand -hex 32`. In `FRONTEND_URL` je Haus eine Adresse
eintragen (und `verwaltung`), sonst weist die API den Browser ab.

## 3. Starten und Plattformkonto anlegen

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api pnpm --filter api prisma:einrichten
```

Nach der Einrichtung `PLATTFORM_PASSWORT` aus `.env` streichen und `up -d api` wiederholen. Die Migrationen laufen beim Start der API. `prisma:einrichten` legt nur die
Plattformverwaltung an (Benutzer `plattform`, Passwort aus `PLATTFORM_PASSWORT`),
keine Demodaten – der Seed leert die Datenbank und gehört nicht auf diesen Server.

## 4. Benutzen

- `http://verwaltung.217-160-128-156.sslip.io` → Plattformverwaltung, dort Häuser anlegen
- `http://<kennung>.217-160-128-156.sslip.io` → das jeweilige Haus
- `http://217-160-128-156.sslip.io` → Landingpage

Neue Häuser brauchen einen Eintrag in `FRONTEND_URL`, danach
`docker compose -f docker-compose.prod.yml up -d api`.

## Aktualisieren und sichern

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

Die Sicherungsskripte in `scripts/` zielen auf die Erprobungsdatenbank; für
diesen Aufbau (Benutzer `ahoi`, Container `postgres`) sind sie noch nicht
angepasst.
