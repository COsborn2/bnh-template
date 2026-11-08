import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";
import { buildPoolConfig } from "./pool-config.js";
import { instrumentDatabase } from "./tracing.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// One round trip per query, directly or through a transaction-mode
// PgBouncer — see pool-config.ts.
const pool = new Pool(
  buildPoolConfig({
    DATABASE_URL: process.env.DATABASE_URL,
    DB_POOL_SIZE: process.env.DB_POOL_SIZE,
  }),
);

// An idle pooled connection that drops (PgBouncer or Postgres restart, a
// network blip) emits 'error' on the pool; unhandled, that would crash the
// process. The pool discards the connection and opens a new one on demand.
pool.on("error", (err) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "db.pool_idle_client_error",
      message: err.message,
    }),
  );
});

export const db = instrumentDatabase(
  drizzle(pool, {
    schema,
    logger: process.env.DB_QUERY_LOGGING === "true",
  }),
);

export const close = () => pool.end();
export type Database = typeof db;
/** Root handle or an open transaction — what services accept so callers
 *  already inside a transaction can join it instead of taking a second
 *  pool connection (and missing their own uncommitted writes). */
export type DbExecutor =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];
export { schema };
