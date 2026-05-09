import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth } from "./lib/auth.js";
import { wsRoutes } from "./routes/ws.js";
import { betterAuthCorsOrigin } from "./lib/config.js";

const app = new Hono().basePath("/api");

// CORS must be registered before routes
app.use(
  "/auth/*",
  cors({
    origin: betterAuthCorsOrigin,
    allowHeaders: ["Content-Type", "Authorization", "x-captcha-response"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    credentials: true,
  })
);

app.use("*", logger());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// WebSocket integration routes
app.route("/ws", wsRoutes);

// better-auth handles all /auth/* routes
app.on(["POST", "GET"], "/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

export { app };
