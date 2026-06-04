import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.NEXT_PUBLIC_HR_CHECKIN_TOKEN ?? "xk9p2mqs";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Obfuscated token URL → rewrite internally to the real checkin page
  if (pathname === `/hr/${TOKEN}`) {
    const url = req.nextUrl.clone();
    url.pathname = "/hr/checkin";
    return NextResponse.rewrite(url);
  }

  // Block direct access to /hr/checkin — must use the token URL
  if (pathname === "/hr/checkin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/hr/:path*",
};
