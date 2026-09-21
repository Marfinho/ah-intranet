FROM node:20-alpine AS deps
WORKDIR /app
# `corepack enable` allein lädt pnpm nicht herunter - das passiert erst beim
# ersten Aufruf und fragt dabei interaktiv nach Bestätigung. Ohne Terminal
# (wie in diesem Build und im Container zur Laufzeit) hängt das für immer,
# deshalb hier explizit und nicht-interaktiv vorbereiten.
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --filter api... --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter api prisma:generate && pnpm --filter api build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
COPY --from=build /app .
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "start"]
