import { and, eq, lt } from "drizzle-orm";
import { schema } from "@app/db";

/** Sessions whose expiry is older than the cutoff. */
export function expiredSessionCleanupWhere(cutoff: Date) {
  return lt(schema.session.expiresAt, cutoff);
}

/** Verification rows (email verification, password reset, ...) past their expiry. */
export function expiredVerificationCleanupWhere(cutoff: Date) {
  return lt(schema.verification.expiresAt, cutoff);
}

/**
 * Accounts that never verified their email within the retention window.
 *
 * NOTE: this assumes email verification is enabled (the API sets
 * `requireEmailVerification: true`). If your project disables email
 * verification, remove the unverified-account step in cleanup.ts —
 * otherwise every user would eventually match this predicate.
 */
export function unverifiedAccountCleanupWhere(cutoff: Date) {
  return and(
    eq(schema.user.emailVerified, false),
    lt(schema.user.createdAt, cutoff),
  );
}
