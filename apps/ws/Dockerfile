FROM oven/bun:1-alpine AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune @app/ws --docker

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile --production

COPY --from=pruner /app/out/full/ .

EXPOSE 3002
USER bun
CMD ["bun", "apps/ws/src/index.ts"]
