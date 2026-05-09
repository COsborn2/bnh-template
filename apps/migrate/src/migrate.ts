import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

// Use max 1 connection for migrations
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

try {
  console.log("Running migrations...");

  const migrationsFolder = new URL("./migrations", import.meta.url).pathname;
  await migrate(db, { migrationsFolder });

  console.log("Migrations complete.");
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown migration error";
  const inspected =
    typeof Bun !== "undefined" ? Bun.inspect(error) : String(error);

  console.error("Migration failed:", error);

  if (
    message.includes("ECONNREFUSED") ||
    inspected.includes('code: "ECONNREFUSED"') ||
    inspected.includes("ECONNREFUSED")
  ) {
    console.error("");
    console.error("Postgres is not reachable using DATABASE_URL.");
    console.error(
      "For local dev, make sure Docker is running and start the database with:",
    );
    console.error("  docker compose up -d postgres");
    console.error("");
    console.error(`Current DATABASE_URL: ${connectionString}`);
  }

  process.exit(1);
} finally {
  await client.end();
}
