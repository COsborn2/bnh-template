# next build runs under real Node on glibc, with Bun used only to install
# dependencies from bun.lock: Bun-as-node cannot run Next 16.3+ builds (a
# CommonJS-wrapper error on Bun <= 1.3.13, a musl segfault on 1.3.14 —
# oven-sh/bun#36866), and sharp's native binary in the standalone output only
# loads on the libc it was installed for, so build and runtime share node:22-slim.
FROM oven/bun:1.4.0-slim@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune @app/web --docker

FROM node:26-slim@sha256:4ebb5ace66f15a24c14c492e01a8beeed4fddf970a856109f5126e703e5fe503 AS build
WORKDIR /app
COPY --from=pruner /usr/local/bin/bun /usr/local/bin/bun
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./

ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY

RUN bun run --filter=@app/web build

FROM node:26-slim@sha256:4ebb5ace66f15a24c14c492e01a8beeed4fddf970a856109f5126e703e5fe503 AS runtime
WORKDIR /app

COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
# Next.js writes to .next/cache at runtime (ISR data, image optimizer, fetch
# cache); create it writable for the non-root user or those writes hit EACCES.
RUN mkdir -p ./apps/web/.next/cache && chown -R node:node ./apps/web/.next

ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "apps/web/server.js"]
