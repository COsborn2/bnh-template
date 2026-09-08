import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { parsePoolSize } from "./pool-size.js";
import { instrumentDatabase } from "./tracing.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}
const connectionString = process.env.DATABASE_URL;

const client = postgres(connectionString, {
  max: parsePoolSize(process.env.DB_POOL_SIZE),
});
export const db = instrumentDatabase(
  drizzle(client, {
    schema,
    logger: process.env.DB_QUERY_LOGGING === "true",
  }),
);

export const close = () => client.end();
export type Database = typeof db;
/** Root handle or an open transaction — what services accept so callers
 *  already inside a transaction can join it instead of taking a second
 *  pool connection (and missing their own uncommitted writes). */
export type DbExecutor =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];
export { schema };
