FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter web build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY --from=build /app .
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
