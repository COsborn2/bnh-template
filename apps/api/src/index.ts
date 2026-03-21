import { app } from "./app.js";
import { initDisposableEmailBlocklist } from "./services/email-validation.js";

await initDisposableEmailBlocklist();

const port = parseInt(process.env.PORT || "3001");

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`API running on http://localhost:${server.port}`);
