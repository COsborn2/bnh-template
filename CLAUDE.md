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
  `REPLACEMENT_FILES` in `bin/create.ts`. `infra/proxy` (the Caddy source) lives only
  here. README.md and DEPLOYMENT.md are copied into scaffolded apps: keep them generic
  and keep the placeholders. CI's `scaffold` job creates an app and fails on any
  leftover placeholder.
- Anything in a copied file that only makes sense here (the generator, the `scaffold`
  CI job, the proxy build) goes between template-only markers, which scaffolds cut:
  `<!-- template-only -->`…`<!-- /template-only -->` in Markdown (whole lines, or
  inline within a paragraph — never inside a code fence), `# template-only`…
  `# /template-only` lines in YAML and shell (not inside a backslash-continued
  command). Markdown only a scaffold should show goes in an HTML comment opened by a
  `<!-- scaffold-only` line and closed by a `-->` line. This block is wrapped that way.
  `bin/create.test.ts` checks the scaffolded workflows and docs.
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
  `REDIS_URL`); `bun run test:integration` provisions disposable dockerized ones. They
  never use the network: `apps/api/src/__tests__/network-fakes.ts` (installed by the
  test preload) fakes DNS MX lookups and Have I Been Pwned and fails any other
  non-local request, so fake each new third-party call there. Web component tests are
  colocated `*.test.tsx` files using `renderToString`. bun's `mock.module` is
  process-global across test files — import `./x.js?real` to bypass a leaked mock.
- DB latency is round trips, not execution: `packages/db` uses node-postgres
  (one round trip per query, directly or through a transaction-mode
  PgBouncer). On hot paths, join related rows in instead of fetching rows and
  then looking names up, and put independent reads in one `Promise.all`.
  Never add connection startup parameters (PgBouncer refuses the connection)
  or session-level `SET`s — use `SET LOCAL` in a transaction.
  `db.execute()` returns node-postgres's `{ rows }`. drizzle leaves columns
  unqualified in single-table selects, so a correlated `sql` subquery's
  `a = b` can bind both sides to the inner table — use a join, or check
  `.toSQL()`. Index the columns a hot query filters on (Postgres doesn't
  index foreign keys for you). DEPLOYMENT.md "Database Performance" covers
  the driver choice and tuning.
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
  section titles. Use the `Input` and `Select` adapters for fields and the `Switch`
  adapter for on/off settings (never a hand-rolled toggle); a field they can't
  express (a textarea, an input wrapped with an icon or chips) takes `app-field` on
  the element that draws its border so it focuses like `Input`, with no inline
  box-shadow, transform or transition. `font-display` headings are bold and uppercase
  without extra classes.
  In markup and inline styles use ink rules (`border border-ink`, `2px solid
  var(--app-ink)`), hard `var(--app-shadow-*)` shadows (never blur or soft drop
  shadows), square panels, 4px controls, and `var(--bnh-radius-pill)` instead of `999`.
- `next dev` writes `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` and rewrites
  `apps/web/next-env.d.ts`; all three are committed on purpose.
