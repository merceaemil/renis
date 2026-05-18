import type { UserRole } from "@renis/core/roles";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshAccessTokenError";
    user: {
      id?: string;
      keycloakId?: string;
      role?: UserRole;
      institutionId?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    /** Unix timestamp (seconds) when the Keycloak access token expires. */
    expiresAt?: number;
    idToken?: string;
    keycloakId?: string;
    role?: UserRole;
    institutionId?: string | null;
    userId?: string;
    error?: "RefreshAccessTokenError";
  }
}
