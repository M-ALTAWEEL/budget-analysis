import { NextResponse, type NextRequest } from "next/server";

// Runs on the website's server before every /api/v1 call is forwarded to the API
// (the forwarding itself is the rewrite in next.config.ts).
//
// The API sees our server, not the visitor, so we tell it who the visitor is:
// X-Client-IP and X-Client-Country, as Vercel saw them. The API believes those only with
// X-Edge-Secret, a secret the browser never sees. Anything a visitor sends in these
// headers is replaced here, so they can't pretend to be someone else (threat S6,
// docs/design/accounts.md 2.2).

const EDGE_SECRET = process.env.EDGE_SECRET ?? "";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-edge-secret");
  headers.delete("x-client-ip");
  headers.delete("x-client-country");

  if (EDGE_SECRET) {
    // On Vercel, x-real-ip is the address that connected to Vercel; a visitor can't set it.
    const ip = request.headers.get("x-real-ip");
    const country = request.headers.get("x-vercel-ip-country");
    headers.set("x-edge-secret", EDGE_SECRET);
    if (ip) headers.set("x-client-ip", ip);
    if (country) headers.set("x-client-country", country);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/api/v1/:path*",
};
