# Bun Full-Stack Starter

A production-ready Bun monorepo with Hono, Next.js, PostgreSQL, Redis, better-auth, and a Caddy edge proxy. It is designed to work well locally and to deploy cleanly as separate services on Railway.

## Quick Start

### Create a new project

```bash
bunx create-bnh my-app
```

This scaffolds a new project from the template, replaces placeholder names, installs dependencies, and initializes a git repo.

### Work on the template itself

If you are developing this template and want to test `bun create` locally:

```bash
# In this repo
bun link

# From anywhere
bun create bnh my-app
```

`bun link` registers the local `create-bnh` package globally, so `bun create bnh` resolves to your local copy instead of the registry.

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
- Username support with availability checking
- Admin API and built-in admin UI
- Cloudflare Turnstile on auth flows
- Have I Been Pwned password checks
- Disposable email blocking
- Database-backed rate limiting
- Standalone WebSocket service with Redis fan-out
- Proxy-ready deployment topology for Railway and similar platforms
- Dockerfiles for each deployable service
- GHCR publishing workflow for service images
- API tests covering auth, admin, security, and usernames

## Monorepo Structure

```text
bun-template/
├── apps/
│   ├── api/       # Hono API server
│   ├── web/       # Next.js frontend
│   ├── ws/        # Standalone WebSocket server
│   ├── migrate/   # Drizzle migration runner
│   └── cron/      # Scheduled-job shell
├── packages/
│   ├── db/        # Drizzle schema + database client
│   ├── email/     # React Email templates + sender
│   ├── shared/    # Shared TypeScript types
│   └── theme/     # Shared design tokens
├── infra/
│   └── proxy/     # Caddy reverse proxy + loading page
├── docker-compose.yml
├── turbo.json
└── package.json
```

## Getting Started

**Prerequisites:** [Bun](https://bun.sh) 1.3+ and [Docker](https://docs.docker.com/get-docker/)

```bash
# Create a new app
bunx create-bnh my-app
cd my-app

# Review the generated env files
#   .env
#   apps/web/.env.local

# Start PostgreSQL and Redis
docker compose up -d

# Run migrations
bun run db:migrate

# Start local development
bun run dev
```

Local dev URLs:

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- WebSocket: `ws://localhost:3002`
- API docs: [http://localhost:3000/api/auth/reference](http://localhost:3000/api/auth/reference)

### Local Docker Services

The included `docker-compose.yml` starts:

- PostgreSQL 17 on `localhost:5433`
- Redis 7 on `localhost:6379`

Useful commands:

```bash
docker compose up -d
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
| `BETTER_AUTH_URL` | `http://localhost:3000` | Required in deployed environments |
| `PORT` | `3001` | API only |
| `APP_NAME` | `MyApp` | Optional |
| `APP_URL` | `http://localhost:3000` | Required in deployed environments for correct email links |
| `RESEND_API_KEY` | `re_your_key_here` | Optional locally |
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

### `apps/web/.env.local`

| Variable | Local default | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | `MyApp` | Optional |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare test key | Required in deployed environments |
| `NEXT_PUBLIC_WS_URL` | unset | Optional; useful for direct local WS connections, usually omitted in production because the proxy serves `/ws` |

### Deployment-only variables

These are not needed for local dev, but they matter in Railway:

| Variable | Used by | Notes |
|---|---|---|
| `API_INTERNAL_URL` | `apps/web` | Required in Railway so Next.js rewrites `/api/*` to the private API service URL |
| `RAILWAY_DOCKERFILE_PATH` | each Railway service | Points each Railway service at the correct Dockerfile |

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start API, web, and other watch-mode tasks |
| `bun run build` | Build all packages and apps |
| `bun run lint` | Lint the repo |
| `bun run test` | Run the test suite |
| `bun run db:generate` | Generate a Drizzle migration |
| `bun run db:migrate` | Apply pending migrations |
| `bun run seed` | Seed local example data using `.env` |

## Health Checks

These are the useful endpoints when you deploy the services separately:

| Service | Path |
|---|---|
| API | `/api/health` |
| Web | `/health` |
| WebSocket | `/health` |
| Proxy | `/robots.txt` |

## Customizing the App

| What | Where |
|---|---|
| API routes | `apps/api/src/app.ts` |
| Realtime authorization and event handling | `apps/api/src/routes/ws.ts` |
| Frontend routes | `apps/web/src/app/` |
| Database schema | `packages/db/src/schema.ts` |
| Email templates | `packages/email/` |
| Shared protocol types | `packages/shared/` |
| Proxy behavior | `infra/proxy/Caddyfile` |

After schema changes:

```bash
bun run db:generate
bun run db:migrate
```

## Admin

The template includes:

- Admin API endpoints exposed through better-auth
- A built-in `/admin` UI for users with the `admin` role
- User search, moderation, impersonation, session revocation, and deletion flows

To promote a user manually:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
```

## Deployment

Use [DEPLOYMENT.md](./DEPLOYMENT.md) for the detailed Railway guide. It includes:

- recommended service layout
- exact `RAILWAY_DOCKERFILE_PATH` values
- shared vs per-service variables
- initial migration order
- public domain and private networking setup
- cron and migration-service guidance

### Container Publishing

Pushes to `main` publish changed service images to GHCR as:

```text
ghcr.io/<owner>/<repo>/<service>:latest
ghcr.io/<owner>/<repo>/<service>:sha-...
```

The workflow attaches OCI metadata, including `org.opencontainers.image.source`, so packages stay linked back to the repository.

If you want anonymous `docker pull` access, make each package public in GitHub after its first publish:

1. Open the package from the repository owner's `Packages` tab.
2. Open `Package settings`.
3. Under `Danger Zone`, choose `Change visibility` and set it to `Public`.

## License

MIT
