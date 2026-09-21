FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
# Siehe apps/api/Dockerfile: die Sperrdatei gilt auch beim Bau des Abbilds.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

# `next.config.mjs` setzt `output: "standalone"`. Next legt damit einen
# eigenständigen Server samt der tatsächlich benötigten Abhängigkeiten ab -
# ohne Quelltext, ohne Entwicklungswerkzeuge, ohne pnpm. `next start` passte
# dazu nicht und warnt seit Next 15 ausdrücklich davor.
#
# Die statischen Dateien legt Next bewusst **nicht** mit hinein, damit sie sich
# auch über ein CDN ausliefern lassen; sie werden hier daneben kopiert.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

# Ein Webdienst braucht keine root-Rechte; hat er sie, wird aus einer
# Codeausführung sofort die Übernahme des Containers.
USER node
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
