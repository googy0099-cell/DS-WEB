import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const TOKEN = process.env.NEXT_PUBLIC_HR_CHECKIN_TOKEN ?? "xk9p2mqs";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // HR checkin URL obfuscation: /hr/{TOKEN} → /hr/checkin (internal rewrite)
  if (pathname === `/hr/${TOKEN}`) {
    const url = req.nextUrl.clone();
    url.pathname = "/hr/checkin";
    const headers = new Headers(req.headers);
    headers.set("x-checkin-verified", "1");
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // Block direct access to /hr/checkin — allow only when coming from token rewrite
  if ((pathname === "/hr/checkin" || pathname.startsWith("/hr/checkin/")) &&
      req.headers.get("x-checkin-verified") !== "1") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (pathname.startsWith("/admin")) {
    const user = req.auth?.user;
    if (!user) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (user.role !== "STAFF" && user.role !== "OWNER" && user.role !== "CASHIER") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (pathname.startsWith("/profile")) {
    if (!req.auth?.user) {
      return NextResponse.redirect(new URL("/login?callbackUrl=/profile", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*", "/hr/:path*"],
};
