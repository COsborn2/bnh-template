/**
 * App-specific cleanup that must run *before* a user row is hard-deleted.
 *
 * Wired into Better Auth's `databaseHooks.user.delete.before` hook (see
 * lib/auth.ts), which runs — and is awaited — immediately before the user row
 * is deleted, for BOTH the self-service /delete-user flow and admin-initiated
 * removal. Throwing from here aborts the deletion.
 *
 * CAVEAT: two places delete user rows directly via drizzle, WITHOUT going
 * through Better Auth, so the hook does not fire for them: the cron
 * unverified-account sweep (apps/cron/src/cleanup.ts Step 3), which is safe
 * because unverified accounts cannot sign in and therefore own no app
 * content, and the seed's reset of its own users (apps/api/src/db/seed.ts),
 * which calls this function explicitly before deleting. If this function ever
 * gains logic that applies to unverified users, mirror it in the cron step or
 * move it to a shared package both apps import.
 *
 * The starter schema only contains Better Auth's own tables, which clean
 * themselves up via ON DELETE CASCADE (sessions, accounts), so this is a
 * no-op today. As your product grows, handle here whatever the FK cascade
 * can't, for example:
 *
 *   - anonymize content the user authored on resources owned by others,
 *   - delete rows that reference the user without a foreign key,
 *   - remove other users' grants on resources the cascade is about to drop.
 *
 * NOTE: run multi-step cleanup inside a single transaction. It still commits
 * separately from Better Auth's user-row delete, so keep every step
 * idempotent — if the user-row delete fails after this commits, retrying the
 * deletion must complete it safely.
 */
export async function deleteAccountData(_userId: string): Promise<void> {
  // Intentionally empty — see the doc comment above.
}
