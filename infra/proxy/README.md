# Proxy (Caddy)

Caddy reverse proxy that routes traffic to the web and API services. Includes a cold-start loading page served when upstream services are scaled to zero.

## How It Works

- `/api/*` routes to the API service
- Everything else routes to the web service
- When an upstream is unreachable (502), `handle_errors` kicks in:
  - **Browser requests** get a branded loading page that auto-refreshes until the service is up
  - **API requests** (`/api/*`) get a `503` JSON response: `{"error":"Service is starting up","retryAfter":3}`

## Theme Colors

The loading page uses colors from `packages/theme/colors.json` (the shared source of truth). To update colors:

```bash
# Edit the source of truth
vim packages/theme/colors.json

# Regenerate colors.css and loading.html
bun scripts/sync-theme.ts
```

This updates both `apps/web/src/app/colors.css` and `infra/proxy/loading.html`.

## Local Testing

Build and run the container with fake upstream URLs to simulate scale-to-zero:

```bash
docker build -t app-proxy-test .

docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e API_URL=http://localhost:9999 \
  -e WEB_URL=http://localhost:9998 \
  app-proxy-test
```

Then verify:

```bash
# Should show the loading page in a browser
open http://localhost:8080

# Should return 502 (Caddy error status preserved)
curl -s -o /dev/null -w '%{http_code}' http://localhost:8080

# Should return 503 JSON
curl -s http://localhost:8080/api/test
```

`Ctrl+C` to stop the container.

## Files

| File | Purpose |
|------|---------|
| `Caddyfile` | Caddy config with routing and `handle_errors` |
| `Dockerfile` | Container image (caddy:2-alpine + config + loading page) |
| `loading.template.html` | Loading page template with `/* THEME_VARS */` placeholder |
| `loading.html` | Generated loading page (do not edit directly) |
