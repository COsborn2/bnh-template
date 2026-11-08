import type { PoolConfig } from "pg";
import { parsePoolSize } from "./pool-size.js";

/**
 * node-postgres pool settings. Why node-postgres: it sends a parameterised
 * query as Parse/Bind/Execute/Sync in one write and lets Postgres infer the
 * parameter types, so every query is ONE network round trip with no
 * server-side prepared statement. postgres-js (the previous driver) asks for
 * the types first when a query isn't prepared — two round trips per query —
 * and drizzle never prepares unnamed queries. Prepared statements would fix
 * that but don't mix safely with a transaction-mode PgBouncer (Railway's
 * connection pooling).
 *
 * Nothing here is a startup parameter: PgBouncer refuses a connection whose
 * startup packet carries a parameter it doesn't track.
 */
export function buildPoolConfig(env: {
  DATABASE_URL: string;
  DB_POOL_SIZE?: string;
}): PoolConfig {
  return {
    connectionString: withLibpqSslSemantics(env.DATABASE_URL),
    max: parsePoolSize(env.DB_POOL_SIZE),
    // node-postgres closes idle connections after 10 s by default, so the
    // first queries after any short lull would reconnect (TCP, TLS, auth).
    // Five minutes keeps the pool warm between a user's requests while still
    // releasing it when traffic stops.
    idleTimeoutMillis: 5 * 60 * 1000,
    // Recycle connections, so load rebalances across PgBouncer instances
    // (or a replaced database host) after a scale-up or restart.
    maxLifetimeSeconds: 30 * 60,
    connectionTimeoutMillis: 30 * 1000,
    keepAlive: true,
  };
}

/**
 * Keep `sslmode` meaning what it means to libpq (psql, and postgres-js
 * before this): `require` = encrypt without verifying the certificate
 * (Railway's are self-signed). node-postgres alone treats `require` and
 * `prefer` as `verify-full` and would refuse those certificates; its
 * libpq-compatible mode restores the standard meaning. URLs without
 * `sslmode` (or that set `uselibpqcompat` themselves) pass through untouched.
 */
export function withLibpqSslSemantics(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }
  if (
    !url.searchParams.has("sslmode") ||
    url.searchParams.has("uselibpqcompat")
  ) {
    return connectionString;
  }
  url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
}
