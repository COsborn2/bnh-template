// import { db } from "@app/db";

// ============================================================
// Cron job placeholder
// ============================================================
// This script runs as a standalone process, triggered by an
// external scheduler (system cron, Railway cron, etc.).
//
// Add your cleanup/maintenance jobs below.
// Example:
//   import { session } from "@app/db/schema";
//   import { lt } from "drizzle-orm";
//   await db.delete(session).where(lt(session.expiresAt, new Date()));
// ============================================================

async function main() {
  console.log("[cron] Starting cleanup...");

  // Add your jobs here

  console.log("[cron] Cleanup complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[cron] Fatal error:", err);
  process.exit(1);
});
