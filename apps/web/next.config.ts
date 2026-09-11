import type { NextConfig } from "next";
import path from "node:path";

const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:3001";
const wsUrl = process.env.WS_INTERNAL_URL || "http://localhost:3002";
const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Applied to every route Next serves (pages, static assets, and — in dev,
// where the rewrites below run — the /api and /ws proxies; in production the
// edge proxy sends /api and /ws straight to their services). Everything is
// same-origin, so one policy covers it all.
//
// The CSP is deliberately a skeleton: frame-ancestors/object-src/base-uri
// close off clickjacking and injection sinks without constraining scripts. A
// full script-src policy needs nonces, and Next.js nonces require dynamic
// rendering of every page — which would undo static prerendering. Revisit if
// Next ships hash-based support for its inline RSC payload scripts.
const securityHeaders = [
  // Two years, subdomains included. No "preload" — submitting to the browser
  // preload list is effectively irreversible, so that stays a human decision.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // Nothing in the app depends on window.opener across origins: social
  // sign-in is a full-page redirect (authClient.signIn.social) and outbound
  // links don't talk back, so the strictest isolation is free.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  },
  // Legacy duplicate of frame-ancestors for older browsers.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/ws",
        destination: `${wsUrl}/ws`,
      },
    ];
  },
};

export default nextConfig;
