FROM oven/bun:1-alpine AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune @app/cron --docker

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./
RUN bun run --filter=@app/cron build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

COPY --from=build /app/apps/cron/dist ./apps/cron/dist

USER bun
CMD ["bun", "apps/cron/dist/cleanup.js"]
