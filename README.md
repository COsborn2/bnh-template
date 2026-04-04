# Bun Full-Stack Starter

A production-ready full-stack starter template built with Bun, Hono, and Next.js. Ships with complete authentication (better-auth), email verification, admin tools, and a clean monorepo structure so you can skip the boilerplate and start building features.

## Quick Start

### Create a new project

```bash
bunx create-bnh my-app
```

This scaffolds a new project from the template, replacing all placeholder names with your project name, installing dependencies, and initializing a git repo.

### Local development of the template itself

If you're working on the template and want to test `bun create` locally:

```bash
# In the template repo
bun link

# From anywhere
bun create bnh my-app
```

`bun link` registers the local `create-bnh` package globally so `bun create bnh` resolves to your local copy instead of a registry. Changes to the template are picked up immediately — no need to re-link after edits.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| API | Hono |
| Frontend | Next.js, React |
| Database | PostgreSQL, Drizzle ORM |
| Auth | better-auth |
| Email | Resend, React Email |
| Styling | Tailwind CSS |
| Monorepo | Turborepo, Bun workspaces |

## Features

- **Email/password authentication** with email verification
- **Google OAuth** (optional -- leave env vars empty to disable)
- **Password reset** via secure email links
- **Username support** with availability checking
- **Admin API** -- user management, ban/unban, impersonation (API-only, no UI)
- **Cloudflare Turnstile CAPTCHA** on auth endpoints
- **Have I Been Pwned** password checking
- **Disposable email blocking** on signup
- **Rate limiting** (database-backed, per-endpoint rules)
- **Auto-generated API docs** at [`/api/auth/reference`](http://localhost:3000/api/auth/reference) (dev only)
- **Dark/light theme** toggle
- **Comprehensive API test suite** (auth, admin, security, usernames)

## Monorepo Structure

```
bun-template/
├── apps/
│   ├── api/             # Bun + Hono API server
│   │   └── src/
│   │       ├── lib/         # better-auth config, utilities
│   │       ├── services/    # Business logic (email validation)
│   │       └── __tests__/   # API test suite
│   ├── web/             # Next.js 16 frontend
│   │   └── src/
│   │       ├── app/
│   │       │   ├── auth/        # Login, register, verify, reset password
│   │       │   ├── dashboard/   # Main app page (post-login)
│   │       │   └── settings/    # Profile, security, sessions
│   │       ├── components/      # UI components
│   │       └── lib/             # Auth client, API helpers
│   ├── migrate/         # Drizzle migration runner
│   └── cron/            # Scheduled jobs shell
├── packages/
│   ├── db/              # Drizzle schema + database client
│   ├── email/           # React Email templates + Resend sender
│   ├── shared/          # Shared TypeScript types
│   └── theme/           # Design token colors
├── infra/
│   └── proxy/           # Caddy reverse proxy config
├── turbo.json
└── package.json
```

## Getting Started

**Prerequisites:** [Bun](https://bun.sh) (1.3+), [Docker](https://docs.docker.com/get-docker/) (for PostgreSQL and Redis)

```bash
# Create a new project (sets up .env files automatically)
bunx create-bnh my-app
cd my-app

# Configure environment
# Edit .env and apps/web/.env.local with your secrets

# Start PostgreSQL and Redis
docker compose up -d

# Run migrations
bun run db:migrate

# Start development
bun run dev
# API:            http://localhost:3001
# Web:            http://localhost:3000
# WebSocket:      ws://localhost:3002
# Email preview:  http://localhost:4000
# API docs:       http://localhost:3000/api/auth/reference
```

### Docker Services (PostgreSQL & Redis)

The included `docker-compose.yml` runs PostgreSQL 17 and Redis 7. PostgreSQL data is persisted in a Docker volume.

```bash
docker compose up -d       # Start PostgreSQL and Redis
docker compose down        # Stop services (data persisted)
docker compose down -v     # Stop and delete all data
```

The default `.env.example` connection string (`postgresql://postgres:postgres@localhost:5433/myapp`) matches the Docker Compose config out of the box. Port 5433 is used to avoid conflicts with any local PostgreSQL installation on the default port (5432).

Redis runs on the default port (6379) and is required for the WebSocket server. If Redis isn't running, the WS server will log `[redis] connection failed — is Redis running?` and retry automatically.

> **Already have PostgreSQL locally?** Skip Docker for Postgres — just create a database (`createdb myapp`) and make sure `DATABASE_URL` in `.env` points to it. You still need Redis running for WebSocket support.

### Dev Mode Notes

| Service | Dev behavior |
|---|---|
| Resend (email) | Without `RESEND_API_KEY`, emails are logged to the console with clickable action URLs |
| Cloudflare Turnstile | `.env.example` ships with Cloudflare's public test keys (always passes) |
| Google OAuth | Leave `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` empty to disable — email/password still works |

## Environment Variables

**Root `.env`** (API server):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Secret key for signing tokens |
| `BETTER_AUTH_URL` | Yes | Base URL for auth (e.g. `http://localhost:3000`) |
| `PORT` | No | API server port (default: `3001`) |
| `APP_NAME` | No | App name in emails (default: `MyApp`) |
| `APP_URL` | No | Base URL for email links (default: `http://localhost:3000`) |
| `EMAIL_FROM` | No | Email sender address |
| `RESEND_API_KEY` | Prod | Resend API key |
| `TURNSTILE_SECRET_KEY` | Prod | Cloudflare Turnstile secret key |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |

**`apps/web/.env.local`** (Next.js frontend):

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Prod | Cloudflare Turnstile site key |
| `NEXT_PUBLIC_APP_NAME` | No | App name in UI (default: `MyApp`) |
| `NEXT_PUBLIC_API_URL` | Prod | API base URL (uses Next.js proxy in dev) |

**Root `.env`** (WebSocket server + shared):

| Variable | Required | Description |
|---|---|---|
| `REDIS_URL` | Yes | Redis connection string |
| `WS_AUTH_URL` | Yes | URL for session validation (points to API auth endpoint) |
| `WS_AUTHORIZE_URL` | Yes | URL for topic authorization (points to API) |
| `WS_EVENTS_URL` | Yes | URL for event forwarding (points to API) |
| `WS_API_SECRET` | Yes | Shared secret for WS-to-API authentication |

## Scripts

| Command | Description |
|---|---|
| `docker compose up -d` | Start PostgreSQL |
| `bun run dev` | Start API + web in watch mode |
| `bun run build` | Production build (all packages) |
| `bun run lint` | Lint all packages |
| `bun run test` | Run API test suite |
| `bun run db:generate` | Generate migration from schema changes |
| `bun run db:migrate` | Apply pending migrations |

## Adding Your Own Features

| What | Where |
|---|---|
| API routes | `apps/api/src/app.ts` -- add Hono routes or mount sub-routers |
| Frontend pages | `apps/web/src/app/` -- Next.js App Router conventions |
| Database schema | `packages/db/src/schema.ts` -- Drizzle table definitions |
| Email templates | `packages/email/` -- React Email components |
| API tests | `apps/api/src/__tests__/` -- Bun test runner |

After changing the schema, run `bun run db:generate` to create a migration, then `bun run db:migrate` to apply it.

### Admin API

The admin plugin provides a REST API for user management — there is no built-in admin UI. You can explore all available endpoints (including admin) via the interactive API docs at [`/api/auth/reference`](http://localhost:3000/api/auth/reference).

To make a user an admin, set their `role` to `"admin"` in the database:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
```

Admin endpoints include: list users, ban/unban, set roles, impersonate, revoke sessions. All require an authenticated user with the `admin` role.

### Admin Dashboard

The template includes a built-in admin UI at `/admin` (only visible to users with the `admin` role). Features:

- **User management** — search, filter by role/status, pagination
- **User actions** — change role, ban/unban (with reason and duration), revoke sessions
- **User detail** — view sessions, impersonate, delete (with confirmation)
- **Extensible** — add your own admin pages via the "App Admin" placeholder

The admin area returns 404 for non-admin users.

### Customizing the Favicon

The template ships with a generic favicon. To replace it with your own brand, update these files:

| File | Location | Purpose |
|---|---|---|
| `favicon.ico` | `apps/web/src/app/` | Browser tab icon |
| `icon0.svg` | `apps/web/src/app/` | SVG icon (modern browsers) |
| `icon1.png` | `apps/web/src/app/` | PNG fallback (96x96) |
| `apple-icon.png` | `apps/web/src/app/` | Apple touch icon (180x180) |
| `manifest.json` | `apps/web/src/app/` | PWA manifest (update `name` and `short_name`) |
| `web-app-manifest-192x192.png` | `apps/web/public/` | PWA icon (192x192) |
| `web-app-manifest-512x512.png` | `apps/web/public/` | PWA icon (512x512) |
| `favicon.ico` | `infra/proxy/` | Served during cold-start loading page |

[RealFaviconGenerator](https://realfavicongenerator.net) can generate all these files from a single image.

## Deployment

The `infra/proxy/` directory contains a Caddy reverse proxy configuration that routes `/api/*` to the API server and everything else to the Next.js frontend. This is ready to deploy to any container platform (Railway, Fly.io, etc.).

Each app has its own `Dockerfile` or `railway.json` where applicable.

## License

MIT
