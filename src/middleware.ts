import { NextResponse, type NextRequest } from "next/server";

// Force the canonical www domain. Google OAuth (authorized redirect URIs) and
// Auth.js are configured for www.look-tao.com, so the bare apex look-tao.com
// serves pages but breaks sign-in with a "Configuration" error. Redirect the
// apex → www so auth works everywhere.
//
// Behind Railway's proxy the public host arrives in x-forwarded-host, not host —
// check both, and build an explicit absolute URL for the redirect target.
export function middleware(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  if (host === "look-tao.com") {
    return NextResponse.redirect(`https://www.look-tao.com${req.nextUrl.pathname}${req.nextUrl.search}`, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next's static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
