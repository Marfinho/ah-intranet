FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
# `--frozen-lockfile`: ohne das verwirft der Bau die Sperrdatei und zieht, was
# gerade im Registry steht - genau der Weg, über den Lieferketten-Vorfälle in
# ein Abbild geraten. Die Prüfpipeline baut seit jeher so; das Produktionsbild
# tat es nicht.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api prisma:generate && pnpm --filter api build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
# Der Anwendungsbaum gehört dem unprivilegierten Konto, nicht root.
COPY --from=build --chown=node:node /app .
# Ein Webdienst braucht keine root-Rechte; hat er sie, wird aus einer
# Codeausführung sofort die Übernahme des Containers.
USER node
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "start"]
