import type { NextConfig } from "next";

// Where the FastAPI server runs. The browser never calls it directly: it calls
// /api/v1/* on this site and Next.js forwards the request (see rewrites below).
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

// Content Security Policy: the browser refuses anything not listed here, so injected
// <script src="https://evil..."> or a hidden <iframe> simply does not load.
// Google Sign-In needs its script, its styles, its iframe and its API.
// 'unsafe-inline' scripts: Next.js puts small inline scripts in every page (and so does
// our theme script in layout.tsx). Replacing it with per-request nonces is planned for
// the security audit (phase 5, docs/security/THREAT_MODEL.md).
const GOOGLE = "https://accounts.google.com";
// Preview deployments (one per branch) show Vercel's comment toolbar, which loads from
// vercel.live. It is allowed there only: the real site never needs it.
const PREVIEW = process.env.VERCEL_ENV === "preview";
const VERCEL_LIVE = PREVIEW ? " https://vercel.live" : "";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${GOOGLE}/gsi/client${VERCEL_LIVE}`,
  `style-src 'self' 'unsafe-inline' ${GOOGLE}/gsi/style${VERCEL_LIVE}`,
  `img-src 'self' data: blob:${PREVIEW ? " https://vercel.live https://vercel.com" : ""}`,
  `font-src 'self' data:${PREVIEW ? " https://vercel.live https://assets.vercel.com" : ""}`,
  `connect-src 'self' ${GOOGLE}/gsi/${PREVIEW ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
  `frame-src ${GOOGLE}/gsi/${VERCEL_LIVE}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // Only HTTPS for two years, subdomains included.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" }, // older browsers; CSP frame-ancestors for new ones
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No camera, microphone or location for any page, and no third-party frame either.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // The Google sign-in popup has to talk back to this page.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Every page waits for the browser to restore the login session (refresh
    // cookie) before it renders, so no page can be "instant" yet. Validate only
    // segments that opt in with `export const instant = true`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  // In development Next.js needs eval() for fast refresh, so the headers are only sent by
  // production builds (Vercel previews included: test the policy there before merging).
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
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
