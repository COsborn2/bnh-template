FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune @app/migrate --docker

FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS build
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./
RUN bun run --filter=@app/migrate build

FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS runtime
WORKDIR /app

COPY --from=build /app/apps/migrate/dist ./apps/migrate/dist
COPY --from=build /app/apps/migrate/src/migrations ./apps/migrate/dist/migrations

USER bun
CMD ["bun", "apps/migrate/dist/migrate.js"]
