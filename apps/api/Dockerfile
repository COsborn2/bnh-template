FROM oven/bun:1-alpine AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune @app/api --docker

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./
RUN bun run --filter=@app/api build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile --production

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/packages/email ./packages/email
COPY --from=build /app/packages/shared ./packages/shared

EXPOSE 3001
USER bun
CMD ["bun", "apps/api/dist/index.js"]
