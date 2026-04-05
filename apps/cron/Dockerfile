FROM oven/bun:1-alpine AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune @app/cron --docker

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile --production

COPY --from=pruner /app/out/full/ .

USER bun
CMD ["bun", "apps/cron/src/cleanup.ts"]
