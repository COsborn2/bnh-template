FROM oven/bun:1-alpine AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune @app/migrate --docker

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./
RUN bun run --filter=@app/migrate build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

COPY --from=build /app/apps/migrate/dist ./apps/migrate/dist
COPY --from=build /app/apps/migrate/src/migrations ./apps/migrate/dist/migrations

USER bun
CMD ["bun", "apps/migrate/dist/migrate.js"]
