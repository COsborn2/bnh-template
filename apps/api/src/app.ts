import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
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

export { app };
