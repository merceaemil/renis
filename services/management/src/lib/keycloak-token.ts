import { getKeycloakInternalIssuer } from "@renis/core/keycloak-url";

export type RefreshedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  idToken?: string;
};

/** Exchange a Keycloak refresh token for a new access token (server-side). */
export async function refreshKeycloakAccessToken(
  refreshToken: string
): Promise<RefreshedTokens> {
  const issuer = getKeycloakInternalIssuer();
  const clientId =
    process.env.KEYCLOAK_CLIENT_ID ?? process.env.AUTH_KEYCLOAK_ID;
  const clientSecret =
    process.env.KEYCLOAK_CLIENT_SECRET ?? process.env.AUTH_KEYCLOAK_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("KEYCLOAK_CLIENT_ID and KEYCLOAK_CLIENT_SECRET are required");
  }

  const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak token refresh failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    idToken: data.id_token,
  };
}

/** Confirm the user's Keycloak password (e.g. before diploma revocation). */
export async function verifyKeycloakUserPassword(
  email: string,
  password: string
): Promise<boolean> {
  const issuer = getKeycloakInternalIssuer();
  const clientId =
    process.env.KEYCLOAK_CLIENT_ID ?? process.env.AUTH_KEYCLOAK_ID;
  const clientSecret =
    process.env.KEYCLOAK_CLIENT_SECRET ?? process.env.AUTH_KEYCLOAK_SECRET;

  if (!clientId || !clientSecret) return false;

  const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: clientId,
      client_secret: clientSecret,
      username: email,
      password,
    }),
  });

  return res.ok;
}
