import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // REST API routes use Bearer tokens in handlers (not session cookies)
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    return;
  }

  const isLoggedIn = !!req.auth?.user?.id && !!req.auth?.accessToken;
  const isLogin = pathname === "/login";
  const isPublic =
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) return;

  if (!isLoggedIn && !isLogin) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  if (isLoggedIn && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
