const timeDays = (n: number) => n * 24 * 60 * 60 * 1000;

/**
 * Central retention policy for the cleanup job.
 *
 * Keep retention windows in one place so they are easy to audit and adjust.
 * If other services (e.g. the API) ever need to agree on these policies,
 * move this module to packages/shared and import it from @app/shared.
 */
export const RETENTION = {
  /** Expired sessions are purged on the next cleanup run (no extra buffer) */
  EXPIRED_SESSION_BUFFER_MS: 0,

  /** Expired verification tokens are purged on the next cleanup run (no extra buffer) */
  EXPIRED_VERIFICATION_BUFFER_MS: 0,

  /** Unverified accounts are deleted after this period */
  UNVERIFIED_ACCOUNT_RETENTION_MS: timeDays(7),
} as const;
