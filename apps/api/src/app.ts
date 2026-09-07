import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth } from "./lib/auth.js";
import { wsRoutes } from "./routes/ws.js";
import { accountRoutes } from "./routes/account.js";
import { adminRoutes } from "./routes/admin.js";
import { betterAuthCorsOrigin } from "./lib/config.js";
import { logger, errorLogValue } from "./lib/logger.js";
import { traceHttp } from "./middleware/trace-http.js";
import { requestContext } from "./middleware/request-context.js";
import { requireAuth } from "./middleware/auth.js";

const app = new Hono().basePath("/api");

app.use("*", traceHttp());
app.use("*", requestContext);

// CORS must be registered before routes
app.use(
  "/auth/*",
  cors({
    origin: betterAuthCorsOrigin,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-captcha-response",
      "x-request-id",
      "x-correlation-id",
    ],
    exposeHeaders: ["x-request-id"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Example protected route: requireAuth resolves the better-auth session and
// exposes it as c.var.auth, or responds 401 when unauthenticated. See
// middleware/auth.ts for optionalAuth and the admin role-check pattern.
app.get("/me", requireAuth, (c) => c.json({ user: c.var.auth }));

// To cap abuse on a public endpoint, pair a rate-limit policy
// (lib/rate-limits.ts) with the ipRateLimit middleware factory
// (middleware/ip-rate-limit.ts). Auth routes are already covered by
// better-auth's built-in limiter (Redis-backed via customStorage). Example:
//
//   import { publicEndpointRateLimit } from "./middleware/ip-rate-limit.js";
//   app.post("/feedback", publicEndpointRateLimit, (c) => { ... });
//
// For per-user (or per-resource) limits consumed inside a handler, wrap the
// consumer in rateLimitedOr429 (lib/rate-limits.ts) so a RateLimitError
// becomes the same 429:
//
//   await rateLimitedOr429(() => consumeSomethingLimit(c.var.auth.id));

// WebSocket integration routes
app.route("/ws", wsRoutes);

// Signed-in account actions better-auth doesn't expose over HTTP itself
// (POST /account/set-password for users without a credential password).
app.route("/account", accountRoutes);

// Admin-only user listing with composable filters. Distinct from
// better-auth's own /auth/admin/* endpoints, which keep handling
// ban/unban/impersonate/remove.
app.route("/admin", adminRoutes);

// better-auth handles all /auth/* routes
app.on(["POST", "GET"], "/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// Global error handler: HTTPExceptions surface as {error} JSON with their
// status; anything else is logged server-side and sanitized to a 500.
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  logger.error("api.unhandled_error", { error: errorLogValue(err) });
  return c.json({ error: "Internal server error" }, 500);
});

export { app };
