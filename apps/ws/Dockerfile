FROM oven/bun:1-alpine AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune @app/ws --docker

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./
RUN bun run --filter=@app/ws build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

COPY --from=build /app/apps/ws/dist ./apps/ws/dist

EXPOSE 3002
USER bun
CMD ["bun", "apps/ws/dist/index.js"]
