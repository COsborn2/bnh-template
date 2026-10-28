# Bun Full-Stack Starter — agent notes

Bun + Turborepo monorepo. `apps/web` = Next.js 16 App Router (port 3000, rewrites
`/api/*` and `/ws`), `apps/api` = Hono REST + better-auth (port 3001), `apps/ws` = Bun
WebSocket service (port 3002), `apps/migrate` = drizzle migration runner, `apps/cron` =
scheduled cleanup, `packages/shared` = shared types, `packages/db` = drizzle schema +
client, `packages/email` = React Email templates + sender, `packages/otel` = tracing. The
Caddy edge proxy is a published image (`ghcr.io/cosborn2/bnh-template/proxy`) configured
by environment variables.

<!-- template-only -->
- This repo is a template: `bin/create.ts` scaffolds new apps from it, replacing the
  placeholders `MyApp` (display name), `myapp` (db name), `@app/` (workspace scope) and
  `bun-template` (repo name). Every file that contains one of those must be listed in
  `REPLACEMENT_FILES` in `bin/create.ts`; the block between the `template-only` markers
  in this file is stripped from scaffolds. `infra/proxy` (the Caddy source) lives only
  here. README.md and DEPLOYMENT.md are copied into scaffolded apps: keep them generic
  and keep the placeholders. CI's `scaffold` job creates an app and fails on any
  leftover placeholder.
- Scaffolds copy `bun.lock` (it is in `REPLACEMENT_FILES`, renamed with the
  workspaces) and install from it, so new apps start on the template's tested versions
  and the release-age gate never blocks `bun create` or the `scaffold` job.
<!-- /template-only -->
- Never hardcode a product name in user-facing copy — read `NEXT_PUBLIC_APP_NAME` /
  `APP_NAME` (fallback `MyApp`).
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
- Dependencies: root `bunfig.toml` refuses package versions published in the last
  3 days (`minimumReleaseAge`) and Dependabot waits 4 (`cooldown`). "Blocked by
  minimum-release-age" means the version is too new: use an older one, or pass
  `--minimum-release-age 0` for an urgent fix.
- Icons: use named imports from `lucide-react`; they render explicit SVGs in both
  server and client components. Font Awesome imports are blocked by ESLint.
- Shared presentation comes from the standalone `COsborn2/ui` repository
  (https://github.com/COsborn2/ui), published as `@cosborn2/ui`. Use the local UI
  adapters; import each component and its CSS entry. Keep auth/state/network
  policy in the app. Package releases are managed in the standalone UI repository.
- The web app's neobrutalist look (modelled on neobrutalism.com) lives in
  `apps/web/src/app/theme.css` (`--bnh-*` tokens, `--app-*` ink/fill/shadow tokens,
  Tailwind mapping) and `ui-overrides.css` (component restyling in the `overrides`
  layer). Restyle shared components there by class name instead of wrapping or forking
  them; prefer the shared `Surface` adapter over hand-rolled card markup, and the local
  `Tag` and `SectionHeading` (`app-*` classes in `globals.css`) over one-off badges and
  section titles. `font-display` headings are bold and uppercase without extra classes.
  In markup and inline styles use ink rules (`border border-ink`, `2px solid
  var(--app-ink)`), hard `var(--app-shadow-*)` shadows (never blur or soft drop
  shadows), square panels, 4px controls, and `var(--bnh-radius-pill)` instead of `999`.
- `next dev` writes `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` and rewrites
  `apps/web/next-env.d.ts`; all three are committed on purpose.
