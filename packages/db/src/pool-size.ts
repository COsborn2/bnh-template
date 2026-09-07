/** postgres-js's own default pool size. */
export const DEFAULT_POOL_SIZE = 10;

/**
 * Hot request paths fan queries out with Promise.all, so bursts can briefly
 * hold several connections per request — DB_POOL_SIZE lets deployments size
 * the pool to their concurrency. Unset or blank keeps postgres-js's default;
 * garbage fails fast instead of silently building a zero-connection pool
 * that hangs every query.
 */
export function parsePoolSize(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_POOL_SIZE;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `DB_POOL_SIZE must be a positive integer, got ${JSON.stringify(raw)}`,
    );
  }
  return parsed;
}
