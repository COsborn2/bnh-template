# Bun Full-Stack Starter

A production-ready Bun monorepo with Hono, Next.js, PostgreSQL, Redis, better-auth, and a Caddy edge proxy. It is designed to work well locally and to deploy cleanly as separate services on Railway.

## Quick Start

### One-time setup

The `create-bnh` command runs from a local checkout of this repo (it is not
published to npm):

```bash
git clone https://github.com/COsborn2/bnh-template.git
cd bnh-template
bun link
```

`bun link` registers the local `create-bnh` package globally, so `bun create
bnh` works from anywhere and scaffolds from this checkout.

### Create a new project

```bash
bun create bnh my-app
```

This scaffolds a new project from the template, replaces placeholder names,
installs dependencies, and initializes a git repo.

### Get the latest template source

Because the linked command copies straight from your checkout, updating it is
just:

```bash
# In the bnh-template repo
git pull
```

The next `bun create bnh` automatically uses the updated source — there is no
publish or reinstall step.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| API | Hono |
| Frontend | Next.js, React |
| Database | PostgreSQL, Drizzle ORM |
| Realtime | Bun WebSocket server, Redis pub/sub |
| Auth | better-auth |
| Email | Resend, React Email |
| Edge proxy | Caddy |
| Styling | Tailwind CSS |
| Monorepo | Turborepo, Bun workspaces |

## Features

- Email/password authentication with email verification
- Google OAuth support that can be disabled by leaving credentials unset
- Password reset and password-changed email flows
- Self-service change-email and delete-account flows, both confirmed by email, plus connected-accounts (link/unlink Google) and a set-password path for OAuth-only users, all on the settings page
- Username support with availability checking
- Admin API and built-in admin UI
- Cloudflare Turnstile on auth flows
- Have I Been Pwned password checks
- Disposable email blocking
- Redis-backed rate limiting with an in-memory fallback and per-recipient email send limits
- Standalone WebSocket service with Redis fan-out and multi-instance presence
- Structured JSON logging (winston) with request IDs and trace correlation on the API
- Opt-in OpenTelemetry tracing across web, API, WS, and per-query DB spans
- Proxy-ready deployment topology for Railway and similar platforms
- Dockerfiles for each deployable service
- Gated CI/CD: GHCR image publishing plus a single Railway environment patch per deploy
- Security headers on every web response (HSTS, COOP, a skeleton CSP, X-Frame-Options, nosniff, Referrer-Policy)
- API tests covering auth, admin, security, and usernames; component tests for the web UI

## Monorepo Structure

```text
bun-template/
├── apps/
│   ├── api/       # Hono API server
│   ├── web/       # Next.js frontend
│   ├── ws/        # Standalone WebSocket server
│   ├── migrate/   # Drizzle migration runner
│   └── cron/      # Scheduled cleanup jobs
├── packages/
│   ├── db/        # Drizzle schema + database client
│   ├── email/     # React Email templates + sender
│   ├── otel/      # OpenTelemetry tracing helpers
│   ├── shared/    # Shared TypeScript types
│   └── theme/     # Shared design tokens
├── infra/
│   └── proxy/     # Caddy reverse proxy + loading page (template repo only — scaffolded apps use the published image)
├── docker-compose.yml
├── turbo.json
└── package.json
```

## Getting Started

**Prerequisites:** [Bun](https://bun.sh) 1.3+ and [Docker](https://docs.docker.com/get-docker/)

```bash
# Create a new app (see Quick Start for the one-time bun link setup)
bun create bnh my-app
cd my-app

# Review the generated env files
#   .env
#   apps/web/.env.local

# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Run migrations
bun run db:migrate

# Start local development
bun run dev
```

`next dev` writes `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` (Next 16's agent rules) and both `next dev` and `next build` rewrite `apps/web/next-env.d.ts`. All three are committed so the tree stays clean; re-commit them when a Next upgrade changes their content. `next build` also downloads the DM Sans and Fraunces fonts from Google at build time (`next/font/google`) and self-hosts them, so an offline build fails at that step.

Local dev URLs:

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- WebSocket: `ws://localhost:3002`
- API docs: [http://localhost:3000/api/auth/reference](http://localhost:3000/api/auth/reference)

### Local Docker Services

The included `docker-compose.yml` starts:

- PostgreSQL 17 on `localhost:5433`
- Redis 7 on `localhost:6379`
- Jaeger (optional trace viewer) with its UI on `localhost:16686` — start it only when you want local traces

Useful commands:

```bash
docker compose up -d postgres redis
docker compose up -d jaeger
docker compose down
docker compose down -v
```

The default `DATABASE_URL` in `.env.example` already matches the Compose setup.

## Environment Variables

### Root `.env`

These are used by the API locally, and several are also shared by the WebSocket service.

| Variable | Local default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/myapp` | Required |
| `BETTER_AUTH_SECRET` | `dev-secret-change-in-production` | Required |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Required in deployed environments. Auth callbacks and email links derive from it |
| `PORT` | `3001` | API only |
| `APP_NAME` | `MyApp` | Optional |
| `RESEND_API_KEY` | empty | Optional locally — emails log to the console when unset; any non-empty value is used as a real Resend key |
| `EMAIL_FROM` | `MyApp <onboarding@resend.dev>` | Optional |
| `TURNSTILE_SECRET_KEY` | Cloudflare test key | Required in deployed environments |
| `GOOGLE_CLIENT_ID` | empty | Optional |
| `GOOGLE_CLIENT_SECRET` | empty | Optional |
| `REDIS_URL` | `redis://localhost:6379` | Required if you use the WebSocket flow |
| `WS_AUTH_URL` | `http://localhost:3001/api/auth/get-session` | Required for `apps/ws` |
| `WS_AUTHORIZE_URL` | `http://localhost:3001/api/ws/authorize` | Required for `apps/ws` |
| `WS_EVENTS_URL` | `http://localhost:3001/api/ws/events` | Required for `apps/ws` |
| `WS_API_SECRET` | `dev-ws-secret-change-in-production` | Required for API ↔ WS internal auth |
| `DB_QUERY_LOGGING` | unset | Optional; set to `true` to log SQL queries |
| `DB_POOL_SIZE` | unset (`10`) | Optional; postgres-js connections per process. Must be a positive integer — anything else fails fast at startup |
| `LOG_LEVEL` | unset (`info`) | Optional; winston log level for the API's structured JSON logs |
| `RATE_LIMITS_DISABLED` | `false` | Optional; set to `true` to skip app rate limits in dev. Ignored in production |
| `HONEYCOMB_API_KEY` and other `OTEL_*` vars | unset | Optional; see [Observability](#observability). Tracing is a no-op when unset |

### `apps/web/.env.local`

| Variable | Local default | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | `MyApp` | Optional |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare test key | Required in deployed environments |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Optional; the canonical public origin (same value as `BETTER_AUTH_URL`), baked in at build time. Sets `metadataBase` so canonical/Open Graph URLs are absolute; unset or empty means no `metadataBase` |
| `NEXT_ALLOWED_DEV_ORIGINS` | unset | Optional, dev only; comma-separated extra origins allowed to reach the Next dev server (LAN/phone testing) |

### Deployment-only variables

These are not needed for local dev, but they matter in Railway:

| Variable | Used by | Notes |
|---|---|---|
| `API_INTERNAL_URL` | `apps/web` | Required in Railway. Used by the Next.js `/api/*` rewrite, by `apps/web/src/lib/server-api.ts` for server-side data fetching, and by `apps/web/src/proxy.ts`, which refreshes better-auth's cookie cache (`GET /api/auth/get-session`) on SSR page loads when the session-data cookie has expired |
| `WS_INTERNAL_URL` | `apps/web` | Lets Next.js rewrite `/ws` to the private WebSocket service URL when web handles the request directly |
| `RAILWAY_DOCKERFILE_PATH` | each Railway service | Only needed for the fallback where Railway builds from source instead of pulling GHCR images |

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start API, web, and other watch-mode tasks |
| `bun run build` | Build all packages and apps |
| `bun run lint` | Lint the repo (ESLint) and typecheck every workspace (`turbo lint`) — CI runs exactly this |
| `bun run test` | Run the test suite (`turbo test`; the API suites need `DATABASE_URL` and `REDIS_URL`) |
| `bun run test:integration` | Run the whole test suite against a disposable dockerized Postgres + Redis on off-ports (54329/63799): migrates first, needs no `.env`, tears down on exit |
| `bun run db:generate` | Generate a Drizzle migration |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:seed` | Seed local example data using `.env`: creates `alice@email.com` (admin) and `bob@email.com` with the password `MyAppSeed!2026#Local7Hq` through better-auth's real sign-up (so it needs outbound network for the Have I Been Pwned check and the DNS MX lookup). Re-running resets both users |

`bun run db:migrate` runs the same migration runner (`apps/migrate/src/migrate.ts`) that the production `migrate` image runs, so local migrations exercise the exact production code path and print friendly guidance if Postgres is unreachable. `bun run db:generate` still uses drizzle-kit.

### Running individual services

```bash
bun run --filter=@app/api dev
bun run --filter=@app/web dev
bun run --filter=@app/ws dev
```

### Testing notes

- `bun test` inside a workspace runs that workspace alone. Web component tests are colocated `*.test.tsx` files that render with `renderToString` from `react-dom/server` (no DOM); `apps/web/src/test/` holds the shared helpers (`fetch-mock.ts`, `router-stub.tsx`).
- bun's `mock.module` registrations are process-global across every test file in a run (for example `apps/api/src/lib/rate-limits.test.ts` stubs `./redis.js`). A suite that must load the real module imports it as `./module.js?real` and casts to `typeof import("./module.js")` — see `apps/api/src/types/query-specifier-imports.d.ts`.
- The API suites (`apps/api/src/__tests__`) hit the real database and Redis; `bun run test:integration` is the zero-setup way to run them locally.

## Health Checks

These are the useful endpoints when you deploy the services separately:

| Service | Path |
|---|---|
| API | `/api/health` |
| Web | `/health` |
| WebSocket | `/health` |
| Proxy | `/robots.txt` |

## Observability

Distributed tracing is built in via OpenTelemetry. A single trace can span
`browser -> web -> api -> ws`, including per-query DB spans and the Redis
pub/sub hop between `api` and `ws`.

Tracing is **off by default** (zero overhead) until an exporter is configured.
It is vendor-neutral OTLP, so any backend works.

**View traces online (Honeycomb):**

1. Create an ingest API key at [honeycomb.io](https://www.honeycomb.io)
2. Set in `.env`:

   ```bash
   HONEYCOMB_API_KEY=hcaik_your_key_here
   HONEYCOMB_DATASET=myapp   # optional
   ```

3. Run the app — traces appear at [ui.honeycomb.io](https://ui.honeycomb.io).
   Nothing to self-host.

**View traces locally (Jaeger):**

Start just the Jaeger container (it doesn't depend on Postgres/Redis):

```bash
docker compose up -d jaeger
```

Then, instead of the Honeycomb key, set:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Then open the Jaeger UI at <http://localhost:16686>.

All tracing env vars (service-name overrides, DB span tuning) are documented
in `.env.example`.

**Structured logs:** the API logs JSON lines via winston. Every line carries an
`event` name and a `requestId` (honoring sanitized inbound `x-request-id` /
`x-correlation-id` headers, echoing `x-request-id` on responses), plus
`traceId`/`spanId` whenever tracing is active. Unhandled API errors surface to
clients as `{"error": message}` JSON with the matching HTTP status; unexpected
errors return a sanitized 500 and are logged as `api.unhandled_error`.

## Customizing the App

| What | Where |
|---|---|
| API routes | `apps/api/src/app.ts` (inline examples) and `apps/api/src/routes/` (`admin.ts`, `account.ts`, `ws.ts` mounted with `app.route`). Helpers: `readPagination`/`readEnumParam` for list endpoints, `rateLimitedOr429(() => consumeX(...))` for per-user limits inside a handler, `isUniqueViolation(err)` to map a UNIQUE-index race loser to `conflict()`, `guardImpersonation(c.get("auth"))` before writes a support session must not perform |
| Realtime authorization and event handling | `apps/api/src/routes/ws.ts` |
| Frontend routes | `apps/web/src/app/`. Signed-in pages (`/dashboard`, `/settings`) are server components that gate with `serverApiOrNull("/auth/get-session")` + `redirect("/auth/login")` and render a `*-client.tsx` shell with the SSR user as `initialUser` — follow that pattern for new signed-in pages |
| Web UI kit | `apps/web/src/components/ui/`: `Modal`/`ModalOverlay` (portal, scroll lock, Escape, focus trap; `ConfirmDialog` is built on it), `Pagination` + `PAGE_SIZE`, `DataTable` (horizontal scroll, `onRowIntent`), `Toaster` (error toasts persist), `PageLoading`. Hooks in `apps/web/src/hooks/`: `useDismissOnOutside`, `useFocusTrap`, `useDocumentClass`, `usePrefetchOnIntent`, `useWebSocket`. The z-index contract (banner 40, menus 50, modals 100/200, confirmations 300, toasts 400) is documented in `globals.css` |
| Database schema | `packages/db/src/schema.ts` |
| Scheduled cleanup job and retention windows | `apps/cron/src/` |
| Email templates | `packages/email/` (shared `emailStyles`/`emailColors` tokens live in `templates/layout.tsx`) |
| Icons in server components | `apps/web/src/components/ui/fa-icon.tsx` — use `FaIcon` in server components and root-layout chrome; `FontAwesomeIcon` only inside `"use client"` modules (ESLint enforces this) |
| List endpoints | `apps/api/src/lib/pagination.ts` (`readPagination`, `readEnumParam`) on the API and `apps/web/src/components/ui/pagination.tsx` + `apps/web/src/lib/pagination.ts` (`PAGE_SIZE`) on the web |
| Shared protocol types | `packages/shared/` |
| Proxy behavior | `infra/proxy/Caddyfile` in the template repo — the proxy is generic and env-driven, so scaffolded apps run its published image (`ghcr.io/cosborn2/bnh-template/proxy:latest`) rather than carrying the source |

The WebSocket protocol — subscribe/unsubscribe messages, the `presence` server message, the Redis backplane envelope kinds (`event`, `disconnect-user`, `revalidate-topic`, `presence-sync`), and the `4000`-`4999` application close-code convention (no client auto-reconnect; `4001` = disconnected by server) — is documented in [apps/ws/README.md](./apps/ws/README.md).

After schema changes:

```bash
bun run db:generate
bun run db:migrate
```

Note: the cron cleanup job deletes unverified accounts after 7 days (`apps/cron/src/retention.ts`). If you disable `requireEmailVerification` in `apps/api/src/lib/auth.ts`, remove that cleanup step or it will delete legitimate users.

## Admin

The template includes:

- Admin API endpoints exposed through better-auth
- A built-in `/admin` UI for users with the `admin` role
- User search, moderation, impersonation, session revocation, and deletion flows

The users list is served by `GET /api/admin/users` (`apps/api/src/routes/admin.ts`), which combines search, role, status and verified filters server-side and returns a true total. Impersonate/stop use soft navigation (`router.push` + `router.refresh`), and the banner re-probes whenever the signed-in user changes. `bun run db:seed` creates an admin user for local development.

To promote a user manually:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
```

## Deployment

Use [DEPLOYMENT.md](./DEPLOYMENT.md) for the detailed Railway guide. It includes:

- recommended service layout
- GHCR image-based Railway service setup (with a source-build fallback)
- shared vs per-service variables
- GitHub environment and `RAILWAY_TOKEN` setup for gated deploys
- migration ordering and redeploy behavior
- public domain and private networking setup
- cron and migration-service guidance
- the manual `Redeploy All Services` runbook

### Container Publishing and Deploys

On pushes to `main`, CI detects affected services with `turbo query affected`,
builds only those images, and publishes them to GHCR as:

```text
ghcr.io/<owner>/<repo>/<service>:latest
ghcr.io/<owner>/<repo>/<service>:sha-<commit>
```

The workflow attaches OCI metadata, including `org.opencontainers.image.source`, so packages stay linked back to the repository.

Publishing and deploying are gated by the `production` GitHub environment. After all affected images are pushed, a single `railway-deploy` job commits one Railway environment patch that pins every changed service to its immutable `sha-<commit>` image while preserving dashboard-managed deploy settings (replicas, regions, restart policy). The services, images, previous images, and Railway patch workflow ID appear in the run summary for rollback reference.

A manually-triggered `Redeploy All Services` workflow (`.github/workflows/redeploy.yml`) rebuilds and redeploys everything from a selected ref — useful after env var changes, base-image CVE rebuilds, or a wedged environment. See DEPLOYMENT.md for the runbook.

For branch protection, require the `Docker Images` status check — it aggregates the dynamic per-service Docker jobs into one stable check name, and it also fails whenever lint, build, or test fail, so it is safe as the sole required check.

If you want anonymous `docker pull` access, make each package public in GitHub after its first publish:

1. Open the package from the repository owner's `Packages` tab.
2. Open `Package settings`.
3. Under `Danger Zone`, choose `Change visibility` and set it to `Public`.

### Dependabot Auto-Merge

The Dependabot workflow approves and enables auto-merge for minor and patch dependency updates after verifying that the PR only contains Dependabot commits and package manifest or lockfile changes.

For this to work safely:

1. Enable repository auto-merge.
2. Protect `main` with required CI status checks (include the `Docker Images` aggregate check — it is sufficient on its own because it fails whenever lint, build, test, or any affected image build fails, so a broken Dependabot PR can never satisfy the required checks).
3. Add a repository Actions secret named `DEPENDABOT_AUTOMERGE_PAT` using a classic PAT with `repo` scope from the automation account that should appear as the approval and merge actor.

The PAT is used for both the approval and the merge: `github-actions[bot]` approvals fail when **Allow GitHub Actions to create and approve pull requests** is disabled (the recommended hardened setting) and may not satisfy branch-protection review requirements. Using the PAT for the merge also means the resulting merge triggers the normal `push` CI and deploy workflow. If the PAT belongs to your personal account, the approval and auto-merge will be attributed to you; use a machine user PAT if you want a bot identity instead.

## Local Troubleshooting

If `bun run db:migrate` fails with:

```text
PostgresError: role "postgres" does not exist
```

that usually means your local Docker Postgres volume was created earlier with a different database user, and the current `DATABASE_URL` no longer matches it.

If you do not need to preserve local data, reset the local Postgres volume:

```bash
docker compose down -v
docker compose up -d postgres redis
bun run db:migrate
```

If you do need to preserve local data, update `DATABASE_URL` in `.env` to use the existing Postgres role instead of `postgres`.

If you have another Postgres running locally, prefer port `5433` for this repo. The included `docker-compose.yml` maps the container to `localhost:5433` to avoid conflicts with host-level Postgres installs.

## License

MIT
