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
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter api prisma:generate && pnpm --filter api build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY --from=build /app .
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "start"]
