FROM node:22-alpine AS build
WORKDIR /app
# pnpm global statt über Corepack - Begründung in apps/api/Dockerfile.
RUN npm install -g pnpm@10.18.3
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm@10.18.3
COPY --from=build --chown=node:node /app .
# Kein root im Betrieb. Next schreibt zur Laufzeit in `.next/cache`; das gehört
# durch --chown dem Nutzer `node`.
USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
