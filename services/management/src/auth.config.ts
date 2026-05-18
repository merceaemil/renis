import type { NextAuthConfig } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import type { UserRole } from "@renis/core/roles";
import { getKeycloakOidcEndpoints } from "@renis/core/keycloak-url";

function resolveAuthSecret(): string {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "build-time-auth-secret-placeholder-32chars";
  }
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 32 && !value.includes("generate-a-long-random")) {
    return value;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET must be set to a random string of at least 32 characters in .env"
    );
  }
  return "dev-renis-auth-secret-do-not-use-in-production";
}

const oidc = getKeycloakOidcEndpoints();

/** Edge-safe Auth.js config (used by middleware). Node-only logic lives in auth.ts. */
export default {
  trustHost: true,
  secret: resolveAuthSecret(),
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID ?? process.env.AUTH_KEYCLOAK_ID!,
      clientSecret:
        process.env.KEYCLOAK_CLIENT_SECRET ?? process.env.AUTH_KEYCLOAK_SECRET!,
      issuer: oidc.issuer,
      authorization: oidc.authorization,
      token: oidc.token,
      userinfo: oidc.userinfo,
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /** Map JWT claims to session (must match auth.ts — middleware has no Prisma). */
    async session({ session, token }) {
      if (token.error === "RefreshAccessTokenError") {
        session.error = "RefreshAccessTokenError";
        delete session.accessToken;
        return session;
      }
      if (session.user) {
        if (token.userId) session.user.id = String(token.userId);
        if (token.keycloakId) session.user.keycloakId = String(token.keycloakId);
        if (token.email) session.user.email = String(token.email);
        session.user.role = token.role as UserRole | undefined;
        session.user.institutionId =
          (token.institutionId as string | null) ?? null;
      }
      if (token.accessToken) {
        session.accessToken = String(token.accessToken);
      }
      return session;
    },
    authorized({ auth, request }) {
      if (request.nextUrl.pathname === "/login") return true;
      if (request.nextUrl.pathname.startsWith("/verify")) return true;
      if (auth?.error === "RefreshAccessTokenError") return false;
      return !!auth?.user?.id && !!auth?.accessToken;
    },
  },
} satisfies NextAuthConfig;
