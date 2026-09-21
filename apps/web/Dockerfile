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
RUN corepack enable
COPY --from=build --chown=node:node /app .
USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
