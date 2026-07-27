# Deployment on Railway

This guide describes the recommended Railway deployment for this repo as a multi-service app:

- `postgres` for PostgreSQL
- `redis` for Redis
- `api` for the Hono API
- `web` for the Next.js frontend
- `ws` for the standalone WebSocket server
- `proxy` for the public Caddy entrypoint — runs the template repo's published image, not code from your app (see Step 3)
- `migrate` for applying schema migrations
- `cron` as an optional scheduled-job service

This guide assumes:

- your Railway project uses the default `production` environment
- your public app URL will look like `https://myapp-production.up.railway.app`
- you keep `api`, `web`, and `ws` private and expose only `proxy`
- your services are named exactly `postgres`, `redis`, `api`, `web`, `ws`, `proxy`, `migrate`, and `cron`

Those service names matter twice: the variable examples below use Railway reference variables like `${{ api.RAILWAY_PRIVATE_DOMAIN }}`, and the CI deploy script matches Railway services by these exact names when it pins images.

## Before You Start

Gather these first so you never have to stop mid-setup:

| What | Needed for | Where to get it |
|---|---|---|
| Railway account | everything below | [railway.com](https://railway.com) |
| Your app scaffolded and pushed to GitHub | CI/CD image publishing and deploys | Step 0 below |
| Cloudflare Turnstile **site key + secret key** | production auth forms (register/login) | Cloudflare dashboard -> Turnstile -> Add widget (free) |
| Resend API key + verified sender domain | real email delivery (optional but recommended) | [resend.com](https://resend.com) -> API Keys / Domains |
| Google OAuth client ID + secret | Google login (optional) | Google Cloud console -> APIs & Services -> Credentials -> OAuth client ID |
| Honeycomb ingest API key | tracing (optional) | [honeycomb.io](https://www.honeycomb.io) -> environment API keys |

Two credentials are created *during* setup rather than up front — where to get each is spelled out in Step 8:

- `RAILWAY_TOKEN` (a Railway project token; requires the Railway project from Step 1 to exist first)
- `DEPENDABOT_AUTOMERGE_PAT` (a GitHub personal access token; optional)

The order of operations at a glance:

0. Scaffold the app from the template and push it to GitHub (Step 0)
1. Railway: project, databases, app services, public domain (Steps 1–4)
2. Railway: shared + per-service variables, healthchecks (Steps 5–7)
3. GitHub: environments, tokens, variables, branch protection (Step 8)
4. First deploy: `migrate`, then the long-running services (Steps 9–10)
5. Verify everything, then optionally wire up cron (Steps 11–12)

## Railway Features This Guide Uses

This repo follows an image-based deployment pattern:

- each deployable service has its own Dockerfile
- GitHub Actions builds and publishes GHCR images per service
- GitHub Actions pins each changed Railway service to the exact GHCR `sha-<commit>` image tag after publish, in a single Railway environment patch
- Railway source builds (`RAILWAY_DOCKERFILE_PATH`) remain available as a fallback only

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
6. `api` and `ws` both use `redis` (realtime backplane, presence, and API rate limiting).
7. `api`, `migrate`, and the `cron` cleanup job use `postgres`.

Recommended exposure:

- `proxy`: public domain enabled
- `api`: private only
- `web`: private only
- `ws`: private only
- `migrate`: private only
- `cron`: private only

`proxy` resolves the real client IP at the edge (Caddy `trusted_proxies` tuned for Railway's private and CGNAT ranges) and forwards it to upstreams as `X-Real-IP` / `X-Forwarded-For`, overwriting any client-supplied values. The API trusts those headers for auth IP records and per-IP rate limiting, so keep browser traffic on the proxy.

## Service Setup Summary

| Service | Type | Image / Dockerfile | Public domain | Healthcheck |
|---|---|---|---|---|
| `api` | Persistent service | `ghcr.io/<owner>/<repo>/api` (`apps/api/Dockerfile`) | No | `/api/health` |
| `web` | Persistent service | `ghcr.io/<owner>/<repo>/web` (`apps/web/Dockerfile`) | No | `/health` |
| `ws` | Persistent service | `ghcr.io/<owner>/<repo>/ws` (`apps/ws/Dockerfile`) | No | `/health` |
| `proxy` | Persistent service | `ghcr.io/cosborn2/bnh-template/proxy:latest` (published by the template repo) | Yes | `/robots.txt` |
| `migrate` | Migration service | `ghcr.io/<owner>/<repo>/migrate` (`apps/migrate/Dockerfile`) | No | none |
| `cron` | Scheduled job | `ghcr.io/<owner>/<repo>/cron` (`apps/cron/Dockerfile`) | No | none |

`postgres` and `redis` should be added from Railway’s managed database services rather than from this repo.

## Step 0: Scaffold Your App and Push It to GitHub

Skip this step if the app already exists on GitHub.

1. One-time setup for the `create-bnh` command (it runs from a local checkout of the template; it is not published to npm):

   ```bash
   git clone https://github.com/COsborn2/bnh-template.git
   cd bnh-template
   bun link
   ```

2. Scaffold the app (from wherever you keep your projects — the command creates the folder for you):

   ```bash
   bun create bnh my-app
   cd my-app
   ```

   This copies the template with your project name substituted everywhere (package scope, display name, database name), creates `.env` and `apps/web/.env.local` from the examples, installs dependencies, and initializes a git repo with an initial commit. There is no remote yet.

3. Create an **empty** GitHub repository (no README, no .gitignore — the scaffold already has both), then connect and push:

   ```bash
   git branch -M main
   git remote add origin git@github.com:<you>/my-app.git
   git push -u origin main
   ```

   The branch must be named `main` — CI builds images on every push to `main` and deploys from it.

4. Expect that first push's CI run to publish images but end with a red (or approval-gated) `Deploy to Railway` job — Railway and the `RAILWAY_TOKEN` secret don't exist yet. That's normal; Step 3 and Step 8 finish the wiring.

## Step 1: Create the Project

1. Create a new Railway project.
2. Connect the GitHub repo that contains this template so GitHub Actions can publish images from `main`.
3. Stay in the `production` environment while you do the initial setup.

## Step 2: Add Postgres and Redis

1. Add a PostgreSQL service and rename it to `postgres`.
2. Add a Redis service and rename it to `redis`.
3. Wait for both to finish provisioning.

Railway will provide service variables for these, including connection URLs you can reference from other services.

No additional Railway services are needed for rate limiting, presence, or tracing — rate limiting and presence reuse `redis`, and tracing exports to an external OTLP backend only if you configure one (see the observability variables below).

## Step 3: Add the App Services

Create the following services in the Railway project:

1. `api`
2. `web`
3. `ws`
4. `proxy`
5. `migrate`
6. `cron` if you plan to use scheduled jobs now

Recommended setup (GHCR images):

1. Configure each Railway service to deploy from a container image rather than the repo source.
2. Use service names that match the workflow and variable references exactly: `api`, `web`, `ws`, `proxy`, `migrate`, and `cron`.
3. Point each app service at the matching GHCR package from **your** repo for the first deployment:

| Service | Image |
|---|---|
| `api` | `ghcr.io/<owner>/<repo>/api:latest` |
| `web` | `ghcr.io/<owner>/<repo>/web:latest` |
| `ws` | `ghcr.io/<owner>/<repo>/ws:latest` |
| `migrate` | `ghcr.io/<owner>/<repo>/migrate:latest` |
| `cron` | `ghcr.io/<owner>/<repo>/cron:latest` |

For the app services, the `:latest` tag is only for the first deploy. After that, every push to `main` pins each changed service to the immutable `sha-<commit>` tag by committing one scoped Railway environment patch. The deploy script reads the current service config first and carries forward the existing `deploy` block, so dashboard-managed settings such as replicas, regions, and restart policy are preserved across deploys.

### The `proxy` service is different: use the template's published image

The proxy contains no application-specific code — it is a generic Caddy config driven entirely by environment variables, and scaffolded apps do not even contain its source. Point the `proxy` Railway service at the image published by the template repo, and keep it on `:latest`:

```text
ghcr.io/cosborn2/bnh-template/proxy:latest
```

- All behavior is configured through the env vars in Step 6 (`API_URL`, `WEB_URL`, `WS_URL`, plus `APP_NAME` for the cold-start loading page's title).
- Your CI never builds or deploys the proxy — it is not in your repo, so change detection never selects it. The `sha-` pinning story above applies to app services only.
- To pick up a new proxy version published by the template repo, redeploy the `proxy` service from the Railway dashboard — or enable Railway's image auto-update on the service to track `:latest` automatically.

Where the first images come from: CI treats the very first push to `main` as affecting every service, so the initial push publishes all of these images to GHCR. If your repo already had pushes before the CI workflow existed, or you need to reseed the packages, manually dispatch the `Redeploy All Services` workflow once from the Actions tab — it builds and publishes every service image (plus `cron` when `RAILWAY_ENABLE_CRON_REDEPLOY=true`) regardless of what changed, and its images are pushed before its Railway patch step runs, so it seeds GHCR even if the patch fails. Either way, expect the `Deploy to Railway` job of that first run to fail red until Step 8 is complete (the `RAILWAY_TOKEN` environment secret exists and these Railway services are created) — the images are still published before the deploy job runs, so either finish Steps 3 and 8 before your first push or accept one red deploy job on the initial run.

Make sure Railway can pull the images: either make each GHCR package public after its first publish (see the README), or configure registry credentials on the Railway services.

Fallback (Railway source builds): if you prefer to let Railway build from the repo instead, set `RAILWAY_DOCKERFILE_PATH` on each service and keep the source root at `/` — these Dockerfiles need repo-root build context because they use Turbo prune and copy the full workspace before pruning.

| Service | `RAILWAY_DOCKERFILE_PATH` |
|---|---|
| `api` | `apps/api/Dockerfile` |
| `web` | `apps/web/Dockerfile` |
| `ws` | `apps/ws/Dockerfile` |
| `migrate` | `apps/migrate/Dockerfile` |
| `cron` | `apps/cron/Dockerfile` |

The `proxy` cannot use a source build — its source lives only in the template repo. It always runs the published `ghcr.io/cosborn2/bnh-template/proxy:latest` image.

Note that with source builds you lose the CI guarantees below (images validated before deploy, immutable sha pinning, single-patch deploys), so the GHCR image flow is recommended.

## Step 4: Generate the Public Domain

Generate a Railway public domain for `proxy`.

Example:

```text
https://myapp-production.up.railway.app
```

If you plan to use a custom domain later, you can still use the Railway domain first, then switch `BETTER_AUTH_URL` to the custom domain once it is attached.

## Step 5: Configure Shared Variables

Set these in `Project Settings -> Shared Variables`.

These are the variables I recommend configuring as shared because they are truly global, reused by multiple services, or should have one source of truth.

| Variable | Example value | Required | Used by | Notes |
|---|---|---|---|---|
| `APP_NAME` | `MyApp` | Optional but recommended | `api`, `web` | If omitted, the code falls back to `MyApp`. Set it anyway so the UI and emails match your brand. |
| `BETTER_AUTH_URL` | `https://myapp-production.up.railway.app` | Required | `api` | Required for auth callbacks and CORS, and every link in auth emails derives from it. The code falls back to localhost, so production email links will be wrong if you omit it. |
| `BETTER_AUTH_SECRET` | `replace-with-a-long-random-secret` | Required | `api` | Generate a long random secret and keep it stable across deployments. |
| `DATABASE_URL` | `${{ postgres.DATABASE_URL }}` | Required | `api`, `migrate`, `cron` | Reference the managed Postgres service so all DB-backed services use one source of truth. |
| `REDIS_URL` | `${{ redis.REDIS_URL }}` | Required | `api`, `ws`, optionally `cron` | Required for realtime features. Also backs API rate limiting and better-auth rate-limit storage; if Redis is unreachable, limits degrade to per-instance in-memory. |
| `WS_API_SECRET` | `replace-with-another-long-random-secret` | Required | `api`, `ws` | Shared secret for internal WS-to-API requests. If it is unset on `api`, the internal WS routes fail closed with `503`. |

## Step 6: Configure Per-Service Variables

These should be set on each service’s own Variables tab.

### `api`

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `${{ shared.DATABASE_URL }}` | Required | Shared DB connection string. |
| `REDIS_URL` | `${{ shared.REDIS_URL }}` | Required | Realtime publishing, API rate limiting, and better-auth rate-limit storage (keys under `app:rl:*`). |
| `BETTER_AUTH_SECRET` | `${{ shared.BETTER_AUTH_SECRET }}` | Required | Keep stable. |
| `BETTER_AUTH_URL` | `${{ shared.BETTER_AUTH_URL }}` | Required | Public app origin. Also used in email links. |
| `APP_NAME` | `${{ shared.APP_NAME }}` | Optional but recommended | Keeps API emails in sync with the web app name. |
| `WS_API_SECRET` | `${{ shared.WS_API_SECRET }}` | Required | Must match the `ws` service. |
| `TURNSTILE_SECRET_KEY` | `1x0000000000000000000000000000000AA` | Required | Use a real production key. There is no meaningful production fallback here. |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxxxxxx` | Optional but recommended | Without it, emails are only logged to stdout. That is a graceful fallback, but it is not enough for a real deployment. |
| `EMAIL_FROM` | `MyApp <noreply@example.com>` | Optional but recommended | If omitted, it falls back to `onboarding@resend.dev`. Use a verified sender for real email delivery. |
| `GOOGLE_CLIENT_ID` | `1234567890-abc.apps.googleusercontent.com` | Optional | Leave unset to disable Google OAuth. |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | Optional | Leave unset to disable Google OAuth. If you set one Google var, set both. |
| `LOG_LEVEL` | `info` | Optional | Winston level for the API's structured JSON logs (`error`, `warn`, `info`, `debug`). |
| `DB_QUERY_LOGGING` | `false` | Optional | Set to `true` only when debugging SQL. |

Do not set `RATE_LIMITS_DISABLED` in Railway. It is a local-development bypass and the API hard-ignores it when `NODE_ENV=production`, so setting it in production only causes confusion.

Google OAuth note:

- If you enable Google login, the callback lives under your public app origin.
- In this deployment shape, that means using your proxy domain, for example `https://myapp-production.up.railway.app/api/auth/callback/google`.

### `web`

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `API_INTERNAL_URL` | `http://${{ api.RAILWAY_PRIVATE_DOMAIN }}:3001` | Required | Next.js uses this server-side to rewrite `/api/*` to the private API service, and at request time for server-side data fetching (`src/lib/server-api.ts`). |
| `WS_INTERNAL_URL` | `http://${{ ws.RAILWAY_PRIVATE_DOMAIN }}:3002` | Recommended | Next.js uses this server-side to rewrite `/ws` if requests hit the web service directly. |
| `NEXT_PUBLIC_APP_NAME` | `${{ shared.APP_NAME }}` | Optional but recommended | If omitted, the UI falls back to `MyApp`. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `0x4AAAAAAA...` | Required | Required for auth forms to work properly in production. |

Important build-time note:

- `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are build-time values for the `web` Docker image. In the GHCR image flow they come from the GitHub repository variables of the same names (see Step 8), not from Railway.
- Changing them requires rebuilding the `web` image — use the `Redeploy All Services` workflow (see CI/CD Notes) after updating the GitHub repository variables.

### `ws`

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `REDIS_URL` | `${{ shared.REDIS_URL }}` | Required | Redis pub/sub connection, plus presence rosters (`presence:*` hashes). |
| `WS_API_SECRET` | `${{ shared.WS_API_SECRET }}` | Required | Must match `api`. |
| `WS_AUTH_URL` | `http://${{ api.RAILWAY_PRIVATE_DOMAIN }}:3001/api/auth/get-session` | Required | Private API URL for validating sessions. |
| `WS_AUTHORIZE_URL` | `http://${{ api.RAILWAY_PRIVATE_DOMAIN }}:3001/api/ws/authorize` | Required | Private API URL for topic authorization. |
| `WS_EVENTS_URL` | `http://${{ api.RAILWAY_PRIVATE_DOMAIN }}:3001/api/ws/events` | Required | Private API URL for forwarding client messages. |

### `proxy`

The proxy runs the template repo's published image (see Step 3), so these variables are its entire configuration surface:

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `API_URL` | `http://${{ api.RAILWAY_PRIVATE_DOMAIN }}:3001` | Required | Private upstream for `/api/*`. |
| `WEB_URL` | `http://${{ web.RAILWAY_PRIVATE_DOMAIN }}:3000` | Required | Private upstream for the Next.js app. |
| `WS_URL` | `http://${{ ws.RAILWAY_PRIVATE_DOMAIN }}:3002` | Required | Private upstream for `/ws`. |
| `APP_NAME` | `${{ shared.APP_NAME }}` | Optional but recommended | Rendered into the cold-start loading page's browser-tab title. Falls back to `MyApp`. |

Only `proxy` should get a public domain in this recommended setup.

### `migrate`

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `${{ shared.DATABASE_URL }}` | Required | This service only needs the database connection. |

### `cron`

The starter cron job (`apps/cron/src/cleanup.ts`) performs real database cleanup, so it needs the database connection:

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `${{ shared.DATABASE_URL }}` | Required | The cleanup job deletes expired rows via the shared DB client, which requires this at startup. |
| `REDIS_URL` | `${{ shared.REDIS_URL }}` | Optional | Required only if your cron code touches Redis. |

What the cleanup job does on each run:

1. Deletes expired better-auth sessions.
2. Deletes expired verification rows.
3. Deletes unverified accounts older than the retention window (7 days by default, configured in `apps/cron/src/retention.ts`).

Each step is isolated, so one failure does not block the others, and the process exits non-zero if any step failed — Railway surfaces that as a failed scheduled run you can alert on. If you disable `requireEmailVerification` in `apps/api/src/lib/auth.ts`, remove the unverified-account step or it will delete legitimate users.

### Observability variables (optional, any service)

Tracing is off by default and adds zero overhead until an exporter is configured. No new Railway service is required. If you want traces, create a (free-tier) [Honeycomb](https://www.honeycomb.io) account, create an ingest API key, and set on `api`, `ws`, and `web` (add `HONEYCOMB_API_KEY` to shared variables if you prefer one source of truth):

| Variable | Example value | Required | Notes |
|---|---|---|---|
| `HONEYCOMB_API_KEY` | `hcaik_...` | Optional | Enables OTLP trace export to Honeycomb. |
| `HONEYCOMB_DATASET` | `myapp` | Optional | Omit for environment-based datasets. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `https://collector.example.com:4318` | Optional | Alternative: any OTLP/HTTP backend instead of Honeycomb. |
| `OTEL_EXPORTER_OTLP_HEADERS` | `x-api-key=...` | Optional | Comma-separated key=value exporter headers. |
| `OTEL_SERVICE_NAME` | `api` | Optional | Overrides the per-service default service name. |
| `OTEL_DB_TRACING` | `false` | Optional | Set on DB-backed services to disable per-query DB spans (default on when tracing is active). |
| `OTEL_DB_STATEMENT` | `true` | Optional | Attach SQL text to DB spans (off by default). |
| `OTEL_LOG_LEVEL` | `debug` | Optional | Verbose OTel diagnostics. |

## Step 7: Configure Healthchecks

Set Railway healthchecks for the long-running services:

| Service | Healthcheck path |
|---|---|
| `api` | `/api/health` |
| `web` | `/health` |
| `ws` | `/health` |
| `proxy` | `/robots.txt` |

`migrate` and `cron` are not long-running web services, so they do not need HTTP healthchecks.

## Step 8: Set Up GitHub for CI/CD

The CI pipeline needs a few things configured on the GitHub repository before pushes to `main` can deploy.

### The `production` environment and `RAILWAY_TOKEN`

1. In Railway, open your project and go to `Project Settings -> Tokens`.
2. Create a token with the `production` environment selected and a recognizable name (for example `github-ci`). Copy the value immediately — Railway shows it only once.
   - This is a **project token**: it is scoped to exactly this project and environment at creation time. That scoping is the only thing that points CI at the correct Railway project — the deploy script asks Railway which project the token belongs to instead of storing project IDs in the repo. Mint the token in the wrong project and CI will deploy there.
3. In GitHub, open the repo's `Settings -> Environments` and create an environment named exactly `production` (CI also uses a `ci` environment for pull-request image builds; if you skip this, each environment is created automatically the first time a workflow job that references it actually runs).
4. Inside the `production` environment, click `Add environment secret`, name it `RAILWAY_TOKEN`, and paste the Railway project token.
5. Optionally add protection rules (required reviewers, deployment branch restricted to `main`) to the `production` environment — these gate both GHCR publishing and Railway mutation, since the Docker and deploy jobs run against this environment. This is also the clean way to merge the pipeline before Railway is ready: the deploy job waits for approval instead of failing.

Do **not** store `RAILWAY_TOKEN` as a repository-level secret. Any workflow in the repo could read a repo-level copy without passing the `production` environment gate, which defeats the purpose of gating deploys. If you previously created a repo-level `RAILWAY_TOKEN`, delete it after moving the value to the environment secret.

`RAILWAY_TOKEN` must be a Railway **project** token — the deploy script sends it as the `Project-Access-Token` header to Railway's GraphQL API.

### Repository variables

Set these in `Settings -> Secrets and variables -> Actions -> Variables`:

| Variable | Required | Notes |
|---|---|---|
| `RAILWAY_ENABLE_CRON_REDEPLOY` | Optional | Set to `true` only if your Railway project includes the optional `cron` service. Gates cron in both CI deploys and the manual redeploy workflow. |
| `NEXT_PUBLIC_APP_NAME` | Optional but recommended | Baked into the `web` image at build time. Falls back to `MyApp`. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Required for production auth | Baked into the `web` image at build time. Falls back to the non-functional placeholder `test` — auth forms in the deployed web image will not work until this variable is set and the image is rebuilt. |

### `DEPENDABOT_AUTOMERGE_PAT` (optional)

Only needed if you want Dependabot's minor/patch update PRs to approve and merge themselves once CI passes. Without it, Dependabot PRs simply wait for manual review (the auto-merge workflow's approve step fails red on Dependabot PRs, which you can ignore or fix by adding the secret later).

Why a PAT instead of the built-in `GITHUB_TOKEN`: approvals from `github-actions[bot]` fail under the hardened "Allow GitHub Actions to create and approve pull requests: off" setting, and a merge performed by `github-actions[bot]` never triggers the `push` workflow on `main` (GitHub's anti-recursion rule) — so the merged commit would never be built or deployed. The PAT gives both actions a real user identity.

To create and install it:

1. Decide which account should appear as the approver and merger. Your own account works; a dedicated machine account keeps automation visually separate.
2. From that account: GitHub `Settings -> Developer settings -> Personal access tokens -> Tokens (classic) -> Generate new token (classic)`.
3. Name it (for example `myapp-dependabot-automerge`), pick an expiration you are comfortable renewing, and check the `repo` scope. Generate it and copy the value.
4. In the repo: `Settings -> Secrets and variables -> Actions -> New repository secret`, name it `DEPENDABOT_AUTOMERGE_PAT`, and paste the token.

Unlike `RAILWAY_TOKEN`, this secret is deliberately **repository-level**: the auto-merge workflow runs on `pull_request_target` for Dependabot PRs and never passes through the `production` environment gate. The workflow itself limits the blast radius — it refuses PRs containing non-Dependabot commits or files beyond package manifests and lockfiles, and only minor/patch updates auto-merge.

No secret is needed for GHCR — the workflow pushes images with the built-in `GITHUB_TOKEN` (`packages: write`).

### Branch protection

Require the `Docker Images` status check on `main`. It is a stable aggregate job that fails if lint, build, or test failed, if change detection failed, or if any affected per-service Docker build failed — so it is safe as the single required check. The per-service Docker jobs themselves are generated dynamically and cannot be listed as required checks.

## Step 9: Run the Initial Migration

Before you rely on the app, run the `migrate` service once.

Recommended order:

1. Deploy `migrate`.
2. Confirm the logs show `Migrations complete.`
3. Then deploy the long-running services (Step 10).

On later schema changes:

1. Deploy `migrate` first.
2. Then deploy the services that depend on the new schema.

In the CI flow this ordering is handled for you: `migrate` is included in the deploy patch whenever its image changes, so new migration code runs alongside the services that need it.

## Step 10: Deploy the Long-Running Services

Deploy these services after variables are configured and the initial migration has completed:

1. `api`
2. `web`
3. `ws`
4. `proxy`

Once `proxy` is healthy, your app should be reachable at:

```text
https://myapp-production.up.railway.app
```

## CI/CD Notes

On pushes to `main`, `.github/workflows/ci.yml`:

1. lints, builds, tests (against Postgres and Redis service containers), and runs migrations in CI
2. detects affected services with `turbo query affected` and builds a dynamic Docker job matrix — unchanged services spawn no jobs at all (the `proxy` never appears in your app's matrix; its source lives only in the template repo, whose own CI publishes the proxy image)
3. waits for the `production` GitHub environment before the Docker jobs run, so environment protection rules can gate publishing
4. builds and pushes each affected image to GHCR under `sha-<commit>` and `latest` tags
5. after all affected images are pushed, runs a single `railway-deploy` job (also gated on the `production` environment) that resolves every changed Railway service
6. uses `scripts/railway-deploy-image.sh` to commit **one** environment patch (one `environmentPatchCommit` call) that updates the source image of every changed service at once, so back-to-back per-service patches can never race or get lost
7. carries forward each service's current `deploy` block in that patch, preserving dashboard-managed replicas, regions, and restart policies
8. logs the before/after Railway source image values, the environment ID, and the single Railway patch workflow ID to the run summary for rollback reference

Pull requests build affected images without pushing them, so image validation happens before merge.

Concurrency is deploy-safe: pull-request runs cancel superseded runs, but every push to `main` runs to completion (no mid-deploy cancellation). Docker jobs use per-service concurrency groups, and the Railway patch itself is serialized through the ref-independent `railway-deploy` concurrency group, which is shared with the manual redeploy workflow so Railway only ever receives one patch at a time.

The `cron` service is filtered out of Railway deploys unless the repository variable `RAILWAY_ENABLE_CRON_REDEPLOY` is `true`, so projects without the optional cron service are unaffected.

Because CI explicitly pins and deploys the service source image, Railway image auto-updates are optional in this setup. Keeping them enabled is harmless, but CI no longer depends on Railway's image polling cadence.

### Redeploy All Services (manual runbook)

To rebuild and redeploy every service regardless of what changed — after changing `NEXT_PUBLIC_*` build args, rebuilding for a base-image CVE, or recovering a wedged environment — manually trigger the `Redeploy All Services` workflow (`.github/workflows/redeploy.yml`) from the Actions tab:

1. It rebuilds all service images (`web`, `api`, `ws`, `migrate`, plus `cron` when `RAILWAY_ENABLE_CRON_REDEPLOY=true`) from the selected ref. The `proxy` is skipped in scaffolded apps (no source in the repo) — redeploy it from the Railway dashboard instead if you need to pick up a new template proxy version.
2. It pushes `sha-<commit>`, `latest`, and a run-unique `sha-<commit>-redeploy-<run>` tag.
3. It commits one Railway environment patch pointing every service at the run-unique tag. The run-unique tag guarantees the patch differs from the current config, so Railway redeploys even when the same commit is already live (Railway skips services whose config is unchanged).

It runs against the `production` environment (same approval gate and `RAILWAY_TOKEN`) and shares the ref-independent `railway-deploy` concurrency group with CI, so a manual redeploy never patches Railway concurrently with a CI deploy — even when dispatched from a tag or non-main branch.

### Testing the deploy script locally

To test the Railway deployment resolver without changing production, run:

```sh
SERVICES="web api" \
IMAGE_PREFIX=ghcr.io/<owner>/<repo> \
COMMIT_SHA=<commit> \
DRY_RUN=true \
RAILWAY_TOKEN=<railway-project-token> \
scripts/railway-deploy-image.sh
```

`DRY_RUN=true` stops before committing the patch, but the token is still required because the script resolves project, environment, and service IDs through the Railway API first.

## Step 11: Verify the Deployment

Check these in order:

1. Visit the proxy public URL and confirm the home page loads.
2. Open `https://myapp-production.up.railway.app/api/health` and confirm you get `{ "status": "ok" }`.
3. Open `https://myapp-production.up.railway.app/health` and confirm the web health route works through the proxy.
4. Register a user and confirm auth flows work.
5. Trigger an email flow and verify email delivery if `RESEND_API_KEY` is configured.
6. If you use Google OAuth, confirm the callback URL configured in Google matches the proxy domain.
7. If you use the realtime example, confirm the browser connects to `/ws` through the proxy, that `api`, `ws`, and `redis` all show healthy logs, and that the online-users presence list updates when a second browser joins.
8. If you configured tracing, confirm traces arrive in Honeycomb (or your OTLP backend) after clicking through the app.
9. Push a trivial change to `main` and confirm the CI run publishes the affected images and the `Deploy to Railway` job summary lists the patched services and images.

## Step 12: Optional Cron Setup

If you want scheduled jobs:

1. Enable the `cron` service and set `RAILWAY_ENABLE_CRON_REDEPLOY=true` in the GitHub repository variables so deploys include it.
2. Configure a schedule in Railway using a standard five-field cron expression.
3. Make sure the process exits when work is finished.

The starter `apps/cron/src/cleanup.ts` exits cleanly (non-zero when any cleanup step failed), which makes it safe to run as a scheduled job and easy to alert on.

## Recommended Railway-Specific Conventions

- Expose only `proxy` publicly.
- Use Railway private domains for all internal service-to-service traffic.
- Keep `BETTER_AUTH_URL` pointed at the public proxy domain — auth callbacks, CORS, and email links all derive from it.
- Keep browser WebSocket traffic on same-origin `/ws`; use server-side routing env vars for upstream service URLs.
- Keep `migrate` as a dedicated service so schema changes stay explicit and easy to rerun.
- Keep secrets in shared variables only when multiple services need them; otherwise prefer service-local variables.
- Keep `RAILWAY_TOKEN` only as a `production` environment secret in GitHub, never repository-level.

## Common Mistakes

| Problem | Cause | Fix |
|---|---|---|
| Auth links point at localhost | `BETTER_AUTH_URL` was left on the fallback — it is the sole variable controlling auth and email link origins | Set it to the real proxy domain and redeploy `api` |
| Web requests to `/api/*` fail | `API_INTERNAL_URL` is missing or points to a public URL | Set it to the API private domain and redeploy `web` |
| WebSocket connections fail in production | `proxy` is missing `WS_URL`, or direct web-service access is missing `WS_INTERNAL_URL` | Route browser traffic through same-origin `/ws` and set the server-side upstream URL for the service handling it |
| WS auth fails, or `/api/ws/*` returns `503` | `WS_API_SECRET` does not match between `api` and `ws`, or is unset on `api` (the internal WS routes fail closed) | Use the same shared secret in both services |
| Emails only appear in logs | `RESEND_API_KEY` is unset | Add a real Resend API key and redeploy `api` |
| Turnstile never validates | Site key and secret key do not match environments | Set the production site key on `web` and the matching secret on `api` |
| Latest changes do not appear after CI succeeds | The service was not affected by change detection, the `Deploy to Railway` job is waiting on the `production` environment approval, or Railway could not pull the GHCR image | Confirm the service appears in the CI run's affected list and deploy summary, approve the pending environment deployment, and make sure Railway can access `ghcr.io/<owner>/<repo>/<service>:sha-<commit>` |
| CI deploy job fails resolving services | `RAILWAY_TOKEN` is missing from the `production` environment, is not a project token, or Railway service names do not match `web`/`api`/`ws`/`proxy`/`migrate`/`cron` | Store a Railway project token as the `production` environment secret and align service names |
| Railway cannot pull `ghcr.io/<owner>/<repo>/<service>:latest` during first setup | The images were never published (the repo predates the CI workflow) or the GHCR packages are still private | Dispatch `Redeploy All Services` once to publish every image, then make each package public or configure registry credentials |
| Rate limits behave differently per instance | `REDIS_URL` is unset or Redis is unreachable, so limits fall back to per-instance memory | Point `REDIS_URL` at the shared `redis` service |
