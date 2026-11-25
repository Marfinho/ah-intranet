FROM node:26-alpine AS build
WORKDIR /app
# Alpine bringt von Haus aus kein OpenSSL mit. Der Client selbst braucht es seit
# Prisma 7 nicht mehr (Treiber `node-pg` statt Rust-Engine), die Migrations-
# Engine, die beim Start `prisma migrate deploy` ausführt, aber weiterhin.
RUN apk add --no-cache openssl
# pnpm global statt über Corepack: Corepack lädt beim ersten Aufruf nach und
# fragt dabei interaktiv - und legt das Ergebnis im Home des ausführenden
# Nutzers ab. Das Image läuft als `node`, nicht als root; eine globale
# Installation steht jedem Nutzer ohne Download zur Verfügung.
RUN npm install -g pnpm@10.18.3
COPY . .
# Das Lockfile ist die Quelle der Wahrheit: ohne `--frozen-lockfile` löste der
# Bau Versionen auf, die nie getestet wurden, und das Image wäre nicht
# reproduzierbar.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api prisma:generate && pnpm --filter api build

FROM node:26-alpine
WORKDIR /app
# Für die Migrations-Engine, siehe oben.
RUN apk add --no-cache openssl
RUN npm install -g pnpm@10.18.3
COPY --from=build --chown=node:node /app .
# Kein root im Betrieb: ein Fehler in der Anwendung soll nicht gleich den
# Container beherrschen.
USER node
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "start"]
