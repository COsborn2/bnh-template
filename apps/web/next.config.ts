import type { NextConfig } from "next";

const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:3001";
const wsUrl = process.env.WS_INTERNAL_URL || "http://localhost:3002";

const nextConfig: NextConfig = {
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
