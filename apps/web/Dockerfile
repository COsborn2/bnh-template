FROM oven/bun:1-alpine AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune @app/web --docker

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./

ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY

RUN bun run --filter=@app/web build

FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "apps/web/server.js"]
