// Canonical public origin of the web app (e.g. https://app.example.com).
// NEXT_PUBLIC_* values are inlined at build time, so this is a build-time
// setting: static pages resolve their metadata (metadataBase, Open Graph URLs)
// when `next build` runs. An empty build arg counts as unset.
const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || undefined;

export const SITE_URL_IS_CONFIGURED = Boolean(raw);
export const SITE_URL = (raw ?? "http://localhost:3000").replace(/\/$/, "");
