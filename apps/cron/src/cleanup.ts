import { db, schema, close } from "@app/db";
import { RETENTION } from "./retention.js";
import {
  expiredSessionCleanupWhere,
  expiredVerificationCleanupWhere,
  unverifiedAccountCleanupWhere,
} from "./cleanup-predicates.js";

// ============================================================
// Cleanup job
// ============================================================
// Runs as a standalone process, triggered by an external
// scheduler (system cron, Railway cron, etc.).
//
// Each step runs in its own try/catch so one failing step never
// blocks the others; any failure flips `failed` so the scheduler
// sees a non-zero exit code for partial failures.
//
// better-auth never garbage-collects expired session or
// verification rows itself, so these steps apply to any project
// built on this template. Add product-specific steps (soft-delete
// purges, stale-data expiry, etc.) following the same pattern.
// ============================================================

const start = Date.now();
let failed = false;
console.log("[cleanup] Starting cleanup job...");

// Step 1: Expired sessions
try {
  const cutoff = new Date(Date.now() - RETENTION.EXPIRED_SESSION_BUFFER_MS);
  const deleted = await db
    .delete(schema.session)
    .where(expiredSessionCleanupWhere(cutoff))
    .returning({ id: schema.session.id });

  console.log(`[cleanup] Deleted ${deleted.length} expired sessions`);
} catch (error) {
  console.error("[cleanup] Failed to clean up expired sessions:", error);
  failed = true;
}

// Step 2: Expired verification rows
try {
  const cutoff = new Date(
    Date.now() - RETENTION.EXPIRED_VERIFICATION_BUFFER_MS,
  );
  const deleted = await db
    .delete(schema.verification)
    .where(expiredVerificationCleanupWhere(cutoff))
    .returning({ id: schema.verification.id });

  console.log(`[cleanup] Deleted ${deleted.length} expired verification rows`);
} catch (error) {
  console.error("[cleanup] Failed to clean up verification rows:", error);
  failed = true;
}

// Step 3: Unverified accounts (FK cascade removes their sessions/accounts)
//
// NOTE: this deletes user rows directly, WITHOUT running deleteAccountData
// (apps/api/src/services/account.ts) — that hook only fires for deletions
// that go through Better Auth. Safe today because unverified accounts
// cannot sign in and therefore own no app content; if deleteAccountData
// ever gains logic that applies to unverified users, mirror it here or
// move it to a shared package both apps import.
try {
  const cutoff = new Date(
    Date.now() - RETENTION.UNVERIFIED_ACCOUNT_RETENTION_MS,
  );
  const deleted = await db
    .delete(schema.user)
    .where(unverifiedAccountCleanupWhere(cutoff))
    .returning({ id: schema.user.id });

  console.log(`[cleanup] Deleted ${deleted.length} unverified accounts`);
} catch (error) {
  console.error("[cleanup] Failed to clean up unverified accounts:", error);
  failed = true;
}

console.log(`[cleanup] Finished in ${Date.now() - start}ms`);
await close();
process.exit(failed ? 1 : 0);
