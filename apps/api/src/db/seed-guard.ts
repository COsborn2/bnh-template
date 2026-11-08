/**
 * Decides whether `bun run db:seed` may run, and with which password. The
 * seed deletes and recreates its users, the first of them an admin, and its
 * default password is published in the README, so it only runs unasked
 * against a local database. Anywhere else (NODE_ENV=production, anything
 * Railway runs, or a DATABASE_URL on another host, such as a local .env
 * pointed at a deployed database) it needs ALLOW_SEED=true and a
 * SEED_USER_PASSWORD of its own.
 */

export interface SeedEnv {
  NODE_ENV?: string;
  RAILWAY_ENVIRONMENT_NAME?: string;
  DATABASE_URL?: string;
  ALLOW_SEED?: string;
  SEED_USER_PASSWORD?: string;
}

export type SeedDecision =
  | { ok: true; password: string; customPassword: boolean }
  | { ok: false; reason: string };

const LOOPBACK_HOSTS = new Set(["localhost", "::1", "[::1]"]);

function databaseHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.has(host) || /^127\.\d+\.\d+\.\d+$/.test(host);
}

/** Why this environment isn't a plain local one, or null when it is. */
function remoteReason(env: SeedEnv): string | null {
  if (env.NODE_ENV === "production") return "NODE_ENV is production";
  if (env.RAILWAY_ENVIRONMENT_NAME) {
    return `this is the Railway environment "${env.RAILWAY_ENVIRONMENT_NAME}"`;
  }
  const host = databaseHost(env.DATABASE_URL);
  if (!host) return "DATABASE_URL has no recognisable host";
  if (!isLoopback(host)) return `DATABASE_URL points at ${host}, not this machine`;
  return null;
}

export function decideSeed(env: SeedEnv, defaultPassword: string): SeedDecision {
  const custom = env.SEED_USER_PASSWORD || undefined;
  const remote = remoteReason(env);
  if (!remote) {
    return {
      ok: true,
      password: custom ?? defaultPassword,
      customPassword: custom !== undefined,
    };
  }
  if (env.ALLOW_SEED !== "true") {
    return {
      ok: false,
      reason: `Refusing to seed: ${remote}. The seed deletes and recreates its users, including an admin. To seed a non-local database on purpose, set ALLOW_SEED=true and a SEED_USER_PASSWORD of your own.`,
    };
  }
  if (!custom) {
    return {
      ok: false,
      reason: `Refusing to seed: ${remote}, and SEED_USER_PASSWORD is not set. The default seed password is published in the README, so a non-local database needs its own.`,
    };
  }
  return { ok: true, password: custom, customPassword: true };
}
