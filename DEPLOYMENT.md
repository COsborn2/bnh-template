# Deployment on Railway

This guide describes the recommended Railway deployment for this repo as a multi-service app:

- `postgres` for PostgreSQL
- `redis` for Redis
- `api` for the Hono API
- `web` for the Next.js frontend
- `ws` for the standalone WebSocket server
- `proxy` for the public Caddy entrypoint
- `migrate` for applying schema migrations
- `cron` as an optional scheduled-job service

This guide assumes:

- your Railway project uses the default `production` environment
- your public app URL will look like `https://myapp-production.up.railway.app`
- you keep `api`, `web`, and `ws` private and expose only `proxy`
- your services are named exactly `postgres`, `redis`, `api`, `web`, `ws`, `proxy`, `migrate`, and `cron`

Those service names matter because the variable examples below use Railway reference variables like `${{ api.RAILWAY_PRIVATE_DOMAIN }}`.

## Railway Features This Guide Uses

This setup relies on current Railway features documented here:

- [Variables and shared/reference variables](https://docs.railway.com/develop/variables)
- [Dockerfile builds and `RAILWAY_DOCKERFILE_PATH`](https://docs.railway.com/builds/dockerfiles)
- [Working with public and private domains](https://docs.railway.com/networking/domains/working-with-domains)
- [Services and scheduled jobs](https://docs.railway.com/develop/services)
- [Cron jobs overview](https://docs.railway.com/guides/cron-workers-queues)

## Architecture

Traffic flow in production:

1. The browser talks only to `proxy`.
2. `proxy` routes `/api/*` to `api`.
3. `proxy` routes `/ws` to `ws`.
4. `proxy` routes everything else to `web`.
5. `ws` calls back into `api` over Railway private networking.
6. `api` and `ws` both use `redis`.
7. `api`, `migrate`, and any future DB-backed jobs use `postgres`.

Recommended exposure:

- `proxy`: public domain enabled
- `api`: private only
- `web`: private only
- `ws`: private only
- `migrate`: private only
- `cron`: private only

## Service Setup Summary

| Service | Type | Dockerfile path | Public domain | Healthcheck |
|---|---|---|---|---|
| `api` | Persistent service | `apps/api/Dockerfile` | No | `/api/health` |
| `web` | Persistent service | `apps/web/Dockerfile` | No | `/health` |
| `ws` | Persistent service | `apps/ws/Dockerfile` | No | `/health` |
| `proxy` | Persistent service | `infra/proxy/Dockerfile` | Yes | `/robots.txt` |
| `migrate` | Migration service | `apps/migrate/Dockerfile` | No | none |
| `cron` | Scheduled job | `apps/cron/Dockerfile` | No | none |

`postgres` and `redis` should be added from Railway’s managed database services rather than from this repo.

## Step 1: Create the Project

1. Create a new Railway project.
2. Connect the GitHub repo that contains this template.
3. Stay in the `production` environment while you do the initial setup.

## Step 2: Add Postgres and Redis

1. Add a PostgreSQL service and rename it to `postgres`.
2. Add a Redis service and rename it to `redis`.
3. Wait for both to finish provisioning.

Railway will provide service variables for these, including connection URLs you can reference from other services.

## Step 3: Add the App Services

Create the following services from the same repo:

1. `api`
2. `web`
3. `ws`
4. `proxy`
5. `migrate`
6. `cron` if you plan to use scheduled jobs now

For each service, set `RAILWAY_DOCKERFILE_PATH` in the service variables:

| Service | `RAILWAY_DOCKERFILE_PATH` |
|---|---|
| `api` | `apps/api/Dockerfile` |
| `web` | `apps/web/Dockerfile` |
| `ws` | `apps/ws/Dockerfile` |
| `proxy` | `infra/proxy/Dockerfile` |
| `migrate` | `apps/migrate/Dockerfile` |
| `cron` | `apps/cron/Dockerfile` |

Keep the source root at `/`. These Dockerfiles need repo-root build context because they use Turbo prune and copy the full workspace before pruning.

## Step 4: Generate the Public Domain

Generate a Railway public domain for `proxy`.

Example:

```text
https://myapp-production.up.railway.app
```

If you plan to use a custom domain later, you can still use the Railway domain first, then switch `APP_URL` and `BETTER_AUTH_URL` to the custom domain once it is attached.

## Step 5: Configure Shared Variables

Set these in `Project Settings -> Shared Variables`.

These are the variables I recommend configuring as shared because they are truly global, reused by multiple services, or should have one source of truth.

| Variable | Example value | Required | Used by | Notes |
|---|---|---|---|---|
| `APP_NAME` | `MyApp` | Optional but recommended | `api`, `web` | If omitted, the code falls back to `MyApp`. Set it anyway so the UI and emails match your brand. |
| `APP_URL` | `https://myapp-production.up.railway.app` | Required | `api` | The code falls back to localhost, but production email links will be wrong if you omit it. |
| `BETTER_AUTH_URL` | `https://myapp-production.up.railway.app` | Required | `api` | Required for auth callbacks and CORS. In this architecture it should match `APP_URL`. |
| `BETTER_AUTH_SECRET` | `replace-with-a-long-random-secret` | Required | `api` | Generate a long random secret and keep it stable across deployments. |
| `DATABASE_URL` | `${{ postgres.DATABASE_URL }}` | Required | `api`, `migrate`, optionally `cron` | Reference the managed Postgres service so all DB-backed services use one source of truth. |
| `REDIS_URL` | `${{ redis.REDIS_URL }}` | Required | `api`, `ws`, optionally `cron` | Required for realtime features. |
| `WS_API_SECRET` | `replace-with-another-long-random-secret` | Required | `api`, `ws` | Shared secret for internal WS-to-API requests. |

## Step 6: Configure Per-Service Variables

These should be set on each service’s own Variables tab.

### `api`

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `${{ shared.DATABASE_URL }}` | Required | Shared DB connection string. |
| `REDIS_URL` | `${{ shared.REDIS_URL }}` | Required | Required for the built-in realtime flow. |
| `BETTER_AUTH_SECRET` | `${{ shared.BETTER_AUTH_SECRET }}` | Required | Keep stable. |
| `BETTER_AUTH_URL` | `${{ shared.BETTER_AUTH_URL }}` | Required | Public app origin. |
| `APP_URL` | `${{ shared.APP_URL }}` | Required | Used in email links. The code has a fallback, but the fallback is not valid for Railway. |
| `APP_NAME` | `${{ shared.APP_NAME }}` | Optional but recommended | Keeps API emails in sync with the web app name. |
| `WS_API_SECRET` | `${{ shared.WS_API_SECRET }}` | Required | Must match the `ws` service. |
| `TURNSTILE_SECRET_KEY` | `1x0000000000000000000000000000000AA` | Required | Use a real production key. There is no meaningful production fallback here. |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxxxxxx` | Optional but recommended | Without it, emails are only logged to stdout. That is a graceful fallback, but it is not enough for a real deployment. |
| `EMAIL_FROM` | `MyApp <noreply@example.com>` | Optional but recommended | If omitted, it falls back to `onboarding@resend.dev`. Use a verified sender for real email delivery. |
| `GOOGLE_CLIENT_ID` | `1234567890-abc.apps.googleusercontent.com` | Optional | Leave unset to disable Google OAuth. |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | Optional | Leave unset to disable Google OAuth. If you set one Google var, set both. |
| `DB_QUERY_LOGGING` | `false` | Optional | Set to `true` only when debugging SQL. |

Google OAuth note:

- If you enable Google login, the callback lives under your public app origin.
- In this deployment shape, that means using your proxy domain, for example `https://myapp-production.up.railway.app/api/auth/callback/google`.

### `web`

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `API_INTERNAL_URL` | `http://${{ api.RAILWAY_PRIVATE_DOMAIN }}:3001` | Required | Next.js uses this server-side to rewrite `/api/*` to the private API service. |
| `WS_INTERNAL_URL` | `http://${{ ws.RAILWAY_PRIVATE_DOMAIN }}:3002` | Recommended | Next.js uses this server-side to rewrite `/ws` if requests hit the web service directly. |
| `NEXT_PUBLIC_APP_NAME` | `${{ shared.APP_NAME }}` | Optional but recommended | If omitted, the UI falls back to `MyApp`. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `0x4AAAAAAA...` | Required | Required for auth forms to work properly in production. |

Important build-time note:

- `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are build-time values for the `web` Docker image.
- Changing them requires a redeploy of the `web` service.

### `ws`

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `REDIS_URL` | `${{ shared.REDIS_URL }}` | Required | Redis pub/sub connection. |
| `WS_API_SECRET` | `${{ shared.WS_API_SECRET }}` | Required | Must match `api`. |
| `WS_AUTH_URL` | `http://${{ api.RAILWAY_PRIVATE_DOMAIN }}:3001/api/auth/get-session` | Required | Private API URL for validating sessions. |
| `WS_AUTHORIZE_URL` | `http://${{ api.RAILWAY_PRIVATE_DOMAIN }}:3001/api/ws/authorize` | Required | Private API URL for topic authorization. |
| `WS_EVENTS_URL` | `http://${{ api.RAILWAY_PRIVATE_DOMAIN }}:3001/api/ws/events` | Required | Private API URL for forwarding client messages. |

### `proxy`

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `API_URL` | `http://${{ api.RAILWAY_PRIVATE_DOMAIN }}:3001` | Required | Private upstream for `/api/*`. |
| `WEB_URL` | `http://${{ web.RAILWAY_PRIVATE_DOMAIN }}:3000` | Required | Private upstream for the Next.js app. |
| `WS_URL` | `http://${{ ws.RAILWAY_PRIVATE_DOMAIN }}:3002` | Required | Private upstream for `/ws`. |

Only `proxy` should get a public domain in this recommended setup.

### `migrate`

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `${{ shared.DATABASE_URL }}` | Required | This service only needs the database connection. |

### `cron`

The placeholder cron service has no required variables by default, because the starter job only logs and exits.

If you later add DB-backed or Redis-backed scheduled work, use:

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `${{ shared.DATABASE_URL }}` | Optional | Required only if your cron code touches Postgres. |
| `REDIS_URL` | `${{ shared.REDIS_URL }}` | Optional | Required only if your cron code touches Redis. |

## Step 7: Configure Healthchecks

Set Railway healthchecks for the long-running services:

| Service | Healthcheck path |
|---|---|
| `api` | `/api/health` |
| `web` | `/health` |
| `ws` | `/health` |
| `proxy` | `/robots.txt` |

`migrate` and `cron` are not long-running web services, so they do not need HTTP healthchecks.

## Step 8: Deploy the Services

Deploy these services after variables are configured:

1. `migrate`
2. `api`
3. `web`
4. `ws`
5. `proxy`

`migrate` runs pending migrations and exits after logging `Migrations complete.` The other services remain running and serve traffic through `proxy`.

## Step 9: CI/CD Notes

On pushes to `main`, `.github/workflows/ci.yml`:

1. lints, builds, tests, and runs migrations in CI
2. builds service images for `web`, `api`, `ws`, `cron`, `migrate`, and `proxy`
3. publishes those images to GHCR
4. triggers Railway redeploys for `web`, `api`, `ws`, `proxy`, `migrate`, and optionally `cron`

`migrate` is redeployed when its image changes so new migration code and migration files run immediately with the changed services.

Once `proxy` is healthy, your app should be reachable at:

```text
https://myapp-production.up.railway.app
```

## Step 10: Verify the Deployment

Check these in order:

1. Visit the proxy public URL and confirm the home page loads.
2. Open `https://myapp-production.up.railway.app/api/health` and confirm you get `{ "status": "ok" }`.
3. Open `https://myapp-production.up.railway.app/health` and confirm the web health route works through the proxy.
4. Register a user and confirm auth flows work.
5. Trigger an email flow and verify email delivery if `RESEND_API_KEY` is configured.
6. If you use Google OAuth, confirm the callback URL configured in Google matches the proxy domain.
7. If you use the realtime example, confirm the browser connects to `/ws` through the proxy and that `api`, `ws`, and `redis` all show healthy logs.

## Step 11: Optional Cron Setup

If you want scheduled jobs:

1. Enable the `cron` service.
2. Configure a schedule in Railway using a standard five-field cron expression.
3. Make sure the process exits when work is finished.

The starter `apps/cron/src/cleanup.ts` already exits cleanly, which makes it safe to run as a scheduled job.

## Recommended Railway-Specific Conventions

- Expose only `proxy` publicly.
- Use Railway private domains for all internal service-to-service traffic.
- Keep `APP_URL` and `BETTER_AUTH_URL` identical in this architecture.
- Keep browser WebSocket traffic on same-origin `/ws`; use server-side routing env vars for upstream service URLs.
- Keep `migrate` as a dedicated service so schema changes run through the same deploy pipeline as the app services.
- Keep secrets in shared variables only when multiple services need them; otherwise prefer service-local variables.

## Common Mistakes

| Problem | Cause | Fix |
|---|---|---|
| Auth links point at localhost | `APP_URL` or `BETTER_AUTH_URL` was left on the fallback | Set both to the real proxy domain and redeploy `api` |
| Web requests to `/api/*` fail | `API_INTERNAL_URL` is missing or points to a public URL | Set it to the API private domain and redeploy `web` |
| WebSocket connections fail in production | `proxy` is missing `WS_URL`, or direct web-service access is missing `WS_INTERNAL_URL` | Route browser traffic through same-origin `/ws` and set the server-side upstream URL for the service handling it |
| WS auth fails | `WS_API_SECRET` does not match between `api` and `ws` | Use the same shared secret in both services |
| Emails only appear in logs | `RESEND_API_KEY` is unset | Add a real Resend API key and redeploy `api` |
| Turnstile never validates | Site key and secret key do not match environments | Set the production site key on `web` and the matching secret on `api` |
