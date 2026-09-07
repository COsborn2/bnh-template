# Bun Full-Stack Starter — agent notes

Bun + Turborepo monorepo. `apps/web` = Next.js 16 App Router (port 3000, rewrites
`/api/*` and `/ws`), `apps/api` = Hono REST + better-auth (port 3001), `apps/ws` = Bun
WebSocket service (port 3002), `apps/migrate` = drizzle migration runner, `apps/cron` =
scheduled cleanup, `packages/shared` = shared types, `packages/db` = drizzle schema +
client, `packages/email` = React Email templates + sender, `packages/otel` = tracing,
`packages/theme` = design tokens. `infra/proxy` (Caddy) lives only in this template repo;
scaffolded apps run its published image.

- This repo is a template: `bin/create.ts` scaffolds new apps from it, replacing the
  placeholders `MyApp` (display name), `myapp` (db name), `@app/` (workspace scope) and
  `bun-template` (repo name). Every file that contains one of those must be listed in
  `REPLACEMENT_FILES` in `bin/create.ts`. Never hardcode a product name in user-facing
  copy — read `NEXT_PUBLIC_APP_NAME` / `APP_NAME` (fallback `MyApp`).
- Typecheck: `bun run lint` inside a workspace = `tsc --noEmit` (in `apps/web` too);
  root `bun run lint` = ESLint over the whole repo + `turbo lint` (typecheck of every
  workspace). CI runs the root command, so all workspaces must typecheck.
- Tests: `bun test` inside a workspace; root `bun run test` = `turbo test`. The API
  suites in `apps/api/src/__tests__` need a real Postgres + Redis (`DATABASE_URL`,
  `REDIS_URL`); `bun run test:integration` provisions disposable dockerized ones. Web
  component tests are colocated `*.test.tsx` files using `renderToString`. bun's
  `mock.module` is process-global across test files — import `./x.js?real` to bypass a
  leaked mock.
- Migrations: edit `packages/db/src/schema.ts`, then root `bun run db:generate` and
  `bun run db:migrate`. Never hand-write migration SQL; never rewrite a published
  migration (`apps/migrate/src/migrations.test.ts` pins them).
- Icons: use `FaIcon` (`apps/web/src/components/ui/fa-icon.tsx`) in server components
  and shared chrome; `FontAwesomeIcon` only inside `"use client"` modules (ESLint
  enforces this).
- `next dev` writes `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` and rewrites
  `apps/web/next-env.d.ts`; all three are committed on purpose.
- README.md and DEPLOYMENT.md are copied into scaffolded apps: keep them generic and
  keep the placeholders.
