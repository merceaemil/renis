import { buildKeycloakLogoutUrl } from "@renis/core/keycloak-url";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/auth";

function resolveAuthSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 32 && !value.includes("generate-a-long-random")) {
    return value;
  }
  return "dev-renis-auth-secret-do-not-use-in-production";
}

function postLogoutRedirectUri(req: NextRequest): string {
  const base =
    process.env.MANAGEMENT_PUBLIC_URL?.replace(/\/$/, "") ??
    req.nextUrl.origin;
  return `${base}/login`;
}

/** Clears the Auth.js session and redirects to Keycloak end-session (SSO logout). */
export async function GET(req: NextRequest) {
  const token = await getToken({
    req,
    secret: resolveAuthSecret(),
    secureCookie: req.nextUrl.protocol === "https:",
  });

  const logoutUrl = buildKeycloakLogoutUrl({
    idToken: token?.idToken ? String(token.idToken) : undefined,
    postLogoutRedirectUri: postLogoutRedirectUri(req),
  });

  await signOut({ redirect: false });

  return NextResponse.redirect(logoutUrl);
}
