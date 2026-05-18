import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import { logAudit } from "@renis/core/audit";
import { prisma, UserRole, UserStatus } from "@renis/database";
import authConfig from "@/auth.config";
import { refreshKeycloakAccessToken } from "@/lib/keycloak-token";

/** Refresh Keycloak access token this many seconds before it expires. */
const REFRESH_BUFFER_SEC = 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  events: {
    async signIn({ user, account }) {
      if (account?.provider === "keycloak" && user.email) {
        await logAudit({
          action: "USER_LOGIN",
          entityType: "User",
          actorEmail: user.email,
        }).catch(() => undefined);
      }
    },
    async signOut(message) {
      const email =
        "token" in message && message.token?.email
          ? String(message.token.email)
          : undefined;
      if (email) {
        await logAudit({
          action: "USER_LOGOUT",
          entityType: "User",
          actorEmail: email,
        }).catch(() => undefined);
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, account, profile }) {
      if (account?.provider === "keycloak") {
        if (account.access_token) {
          token.accessToken = account.access_token;
        }
        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
        }
        if (account.expires_at) {
          token.expiresAt = account.expires_at;
        } else if (account.expires_in) {
          token.expiresAt =
            Math.floor(Date.now() / 1000) + Number(account.expires_in);
        }
        if (account.id_token) {
          token.idToken = account.id_token;
        }
        delete token.error;
      }

      if (account?.provider === "keycloak" && profile?.sub) {
        token.keycloakId = profile.sub;
        const email =
          typeof profile.email === "string" ? profile.email : undefined;

        let dbUser = await prisma.user.findUnique({
          where: { keycloakId: profile.sub },
          include: { institution: true },
        });

        if (!dbUser && email) {
          const byEmail = await prisma.user.findUnique({ where: { email } });
          if (byEmail) {
            dbUser = await prisma.user.update({
              where: { id: byEmail.id },
              data: { keycloakId: profile.sub },
              include: { institution: true },
            });
          }
        }

        if (dbUser && dbUser.status === UserStatus.ACTIVE) {
          token.role = dbUser.role;
          token.institutionId = dbUser.institutionId;
          token.userId = dbUser.id;
          token.email = dbUser.email;
        } else {
          delete token.role;
          delete token.institutionId;
          delete token.userId;
        }
      }

      if (!account) {
        return refreshTokenIfNeeded(token);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.error === "RefreshAccessTokenError") {
        session.error = "RefreshAccessTokenError";
        delete session.accessToken;
        return session;
      }
      if (session.user) {
        session.user.role = token.role as UserRole | undefined;
        session.user.institutionId =
          (token.institutionId as string | null) ?? null;
        if (token.userId) session.user.id = String(token.userId);
        if (token.keycloakId) session.user.keycloakId = String(token.keycloakId);
        if (token.email) session.user.email = String(token.email);
      }
      if (token.accessToken) {
        session.accessToken = String(token.accessToken);
      }
      return session;
    },
    async signIn({ profile }) {
      if (!profile?.sub) return false;
      const email =
        typeof profile.email === "string" ? profile.email : undefined;
      let dbUser = await prisma.user.findUnique({
        where: { keycloakId: profile.sub },
      });
      if (!dbUser && email) {
        dbUser = await prisma.user.findUnique({ where: { email } });
      }
      return !!dbUser && dbUser.status === UserStatus.ACTIVE;
    },
  },
});

async function refreshTokenIfNeeded(token: JWT): Promise<JWT> {
  const expiresAt = token.expiresAt;
  const now = Math.floor(Date.now() / 1000);

  if (expiresAt && now < expiresAt - REFRESH_BUFFER_SEC) {
    return token;
  }

  const refreshToken = token.refreshToken;
  if (!refreshToken) {
    return token;
  }

  try {
    const refreshed = await refreshKeycloakAccessToken(refreshToken);
    token.accessToken = refreshed.accessToken;
    token.refreshToken = refreshed.refreshToken;
    token.expiresAt = refreshed.expiresAt;
    if (refreshed.idToken) {
      token.idToken = refreshed.idToken;
    }
    delete token.error;
  } catch {
    token.error = "RefreshAccessTokenError";
    delete token.accessToken;
  }

  return token;
}
