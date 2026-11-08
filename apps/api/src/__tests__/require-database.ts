/**
 * Imported by every suite that needs the real database (setup.ts, and suites
 * that use @app/db directly). Without a database, a bare `bun run test` used
 * to fail every such suite with connection errors that hid the cause; this
 * stops each of them up front with what to run instead.
 */
import { sql } from "drizzle-orm";
import { db } from "@app/db";
import { PLACEHOLDER_DATABASE_URL } from "../test-support/placeholder-database-url.js";

const HOW_TO_RUN =
  "Run `bun run test:integration` at the repo root: it starts a disposable Postgres and Redis, migrates them and sets DATABASE_URL and REDIS_URL. Or point DATABASE_URL at a migrated database (and REDIS_URL at a Redis).";

function describeTarget(url: string): string {
  try {
    const { hostname, port, pathname } = new URL(url);
    return `${hostname}${port ? `:${port}` : ""}${pathname}`;
  } catch {
    return "DATABASE_URL";
  }
}

const url = process.env.DATABASE_URL ?? "";
if (url === PLACEHOLDER_DATABASE_URL) {
  throw new Error(
    `This suite needs a real Postgres, but DATABASE_URL is not set (the test preload's placeholder is in use). ${HOW_TO_RUN}`,
  );
}

let timer: ReturnType<typeof setTimeout> | undefined;
try {
  await Promise.race([
    db.execute(sql`SELECT 1 FROM "user" LIMIT 1`),
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("no answer within 5 s")),
        5000,
      );
    }),
  ]);
} catch (cause) {
  throw new Error(
    `The test database (${describeTarget(url)}) is unreachable or not migrated. ${HOW_TO_RUN}`,
    { cause },
  );
} finally {
  clearTimeout(timer);
}
