FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --filter api... --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
# "prisma generate" läuft in dieser Stufe und erkennt dabei die
# OpenSSL-Version, um die "native"-Engine passend zu benennen. Fehlt
# openssl hier, rät die Erkennung falsch (legacy openssl-1.1.x) - und die
# so falsch benannte Datei lässt sich in der Laufzeit-Stufe nicht laden,
# obwohl die dort installiertes openssl 3 hat. Beide Stufen brauchen es,
# nicht nur die, die den Dienst tatsächlich startet.
RUN apk add --no-cache openssl
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter api prisma:generate && pnpm --filter api build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
# Ohne dieses Paket fehlt libssl.so.3, das die generierte musl-Engine von
# Prisma zur Laufzeit lädt - ohne sie startet die API gar nicht erst.
RUN apk add --no-cache openssl
COPY --from=build /app .
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "start"]
