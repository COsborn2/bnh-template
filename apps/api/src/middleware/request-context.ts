import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { logger, errorLogValue } from "../lib/logger.js";
import { runWithRequestContext } from "../lib/request-context-store.js";

export const requestContext = createMiddleware<{
  Variables: { requestId: string };
}>(async (c, next) => {
  const requestId =
    sanitizeRequestId(c.req.header("x-request-id")) ??
    sanitizeRequestId(c.req.header("x-correlation-id")) ??
    randomUUID();
  const method = c.req.method;
  const path = c.req.path;
  const startedAt = Date.now();

  c.set("requestId", requestId);
  c.header("x-request-id", requestId);

  await runWithRequestContext({ requestId, method, path }, async () => {
    logger.info("api.request_started", { requestId, method, path });
    try {
      await next();
      logger.info("api.request_completed", {
        requestId,
        method,
        path,
        status: c.res.status,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      logger.error("api.request_failed", {
        requestId,
        method,
        path,
        durationMs: Date.now() - startedAt,
        error: errorLogValue(err),
      });
      throw err;
    }
  });
});

function sanitizeRequestId(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return /^[A-Za-z0-9._:/=-]+$/.test(trimmed) ? trimmed : null;
}
