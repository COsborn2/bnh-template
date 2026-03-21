import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}
const connectionString = process.env.DATABASE_URL;

const client = postgres(connectionString);
export const db = drizzle(client, {
  schema,
  logger: process.env.DB_QUERY_LOGGING === "true",
});

export const close = () => client.end();
export type Database = typeof db;
export { schema };
