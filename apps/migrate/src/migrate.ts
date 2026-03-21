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
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await client.end();
  process.exit(0);
}
