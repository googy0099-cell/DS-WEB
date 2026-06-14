import { NextResponse, type NextRequest } from "next/server";

// Force the canonical www domain. Google OAuth (authorized redirect URIs) and
// Auth.js are configured for www.look-tao.com, so the bare apex look-tao.com
// serves pages but breaks sign-in with a "Configuration" error (seen on mobile,
// where users open the apex). Redirect apex → www so auth works everywhere.
export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  if (host === "look-tao.com") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    url.host = "www.look-tao.com";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next's static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
