// Canonical public origin of the web app (e.g. https://app.example.com).
// NEXT_PUBLIC_* values are inlined at build time, so this is a build-time
// setting: static pages resolve their metadata (metadataBase, Open Graph URLs)
// when `next build` runs. An empty build arg counts as unset.

/**
 * Normalises a configured origin the way the API's config.ts treats
 * BETTER_AUTH_URL (the docs say to use the same value): a missing scheme is
 * inferred (`http://` for localhost, `https://` otherwise), a trailing slash
 * is dropped, and anything that still does not parse fails the build with an
 * error that names the variable instead of `new URL()`'s bare TypeError.
 */
export function resolveSiteUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${/^(localhost|127\.0\.0\.1)(:|$)/i.test(trimmed) ? "http" : "https"}://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error(`NEXT_PUBLIC_APP_URL is not a valid URL: "${raw}"`);
  }
  return parsed.origin;
}

const configured = resolveSiteUrl(process.env.NEXT_PUBLIC_APP_URL);

export const SITE_URL_IS_CONFIGURED = configured !== undefined;
export const SITE_URL = configured ?? "http://localhost:3000";
