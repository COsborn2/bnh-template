import { createMiddleware } from "hono/factory";
import { payloadTooLarge } from "../lib/errors.js";

// Rejects a request based on its Content-Length header before any body bytes
// are read. Bun.serve's maxRequestBodySize (see index.ts) is the global hard
// ceiling; use this middleware for tighter per-route caps, e.g.:
//
//   app.post("/feedback", maxBodySize(16 * 1024), handler);
//
// Pair with body parsing further down the middleware chain so Zod validation
// isn't the first thing standing between an attacker and an allocated
// JSON.parse buffer.
export function maxBodySize(limitBytes: number) {
  return createMiddleware(async (c, next) => {
    const method = c.req.method;
    if (method === "GET" || method === "HEAD" || method === "DELETE") {
      return next();
    }

    const header = c.req.header("content-length");
    if (header !== undefined) {
      const length = Number.parseInt(header, 10);
      if (!Number.isFinite(length) || length < 0) {
        throw payloadTooLarge("Invalid Content-Length");
      }
      if (length > limitBytes) {
        throw payloadTooLarge();
      }
    }

    return next();
  });
}
