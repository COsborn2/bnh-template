import "./instrumentation.js";
import { app } from "./app.js";
import { logger } from "./lib/logger.js";
import { initDisposableEmailBlocklist } from "./services/email-validation.js";

await initDisposableEmailBlocklist();

const port = parseInt(process.env.PORT || "3001");

// Hard ceiling on request body size at the Bun layer. Anything larger is
// rejected before we ever allocate it, which keeps a flood of giant bodies
// from inflating the JSC heap to a high-water mark that won't shrink back.
const MAX_REQUEST_BODY_BYTES = 1 * 1024 * 1024;

const server = Bun.serve({
  port,
  fetch: app.fetch,
  maxRequestBodySize: MAX_REQUEST_BODY_BYTES,
});

logger.info("api.server_started", {
  port: server.port,
  url: `http://localhost:${server.port}`,
});
