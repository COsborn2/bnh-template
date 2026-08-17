import type { NextConfig } from "next";
import path from "node:path";

const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:3001";
const wsUrl = process.env.WS_INTERNAL_URL || "http://localhost:3002";
const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  // next 16.3.1 bumped @swc/helpers to 0.5.23, whose exports map added a
  // `module-sync` condition resolving to esm/*.js. At runtime, Node >= 22.12
  // (require(esm) enabled) resolves require("@swc/helpers/...") through that
  // condition to the esm files, but the build-time file tracer still resolves
  // the `default` condition and ships only cjs/*.cjs — so the standalone
  // server dies on boot with MODULE_NOT_FOUND for @swc/helpers/esm/*. Force
  // the complete package (cjs + esm + package.json) from Bun's isolated store
  // into the trace until the tracer understands module-sync. The glob must
  // target the real store directory, not a node_modules symlink to it —
  // including through a symlink makes the copier materialize a partial
  // directory over the symlink in the standalone output, which breaks
  // resolution in a new way.
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.bun/@swc+helpers@*/node_modules/@swc/helpers/**",
    ],
  },
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
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
