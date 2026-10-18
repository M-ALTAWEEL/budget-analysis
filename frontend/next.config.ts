import type { NextConfig } from "next";

// Where the FastAPI server runs. The browser never calls it directly: it calls
// /api/v1/* on this site and Next.js forwards the request (see rewrites below).
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Every page waits for the browser to restore the login session (refresh
    // cookie) before it renders, so no page can be "instant" yet. Validate only
    // segments that opt in with `export const instant = true`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  // Same-origin API: no CORS preflights, and the refresh-token cookie is a
  // first-party cookie of this site (browsers increasingly block third-party ones).
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_ORIGIN}/api/v1/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
