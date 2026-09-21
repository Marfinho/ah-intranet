FROM node:20-alpine AS build
WORKDIR /app
# `corepack enable` allein lädt pnpm nicht herunter - das passiert erst beim
# ersten Aufruf und fragt dabei interaktiv nach Bestätigung. Ohne Terminal
# (wie in diesem Build und im Container zur Laufzeit) hängt das für immer,
# deshalb hier explizit und nicht-interaktiv vorbereiten.
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter web build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
COPY --from=build /app .
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
