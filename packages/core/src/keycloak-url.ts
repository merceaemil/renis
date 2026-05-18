/** Public issuer (browser redirects, JWT `iss` claim). */
export function getKeycloakPublicIssuer(): string {
  return (
    process.env.KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/renis"
  ).replace(/\/$/, "");
}

/** Server-side issuer (OIDC discovery / JWKS from inside Docker). */
export function getKeycloakInternalIssuer(): string {
  return (
    process.env.KEYCLOAK_INTERNAL_ISSUER ??
    process.env.KEYCLOAK_ISSUER ??
    "http://localhost:8080/realms/renis"
  ).replace(/\/$/, "");
}

function hostFromIssuer(issuer: string): string | undefined {
  return issuer.match(/^(https?:\/\/[^/]+)/)?.[1];
}

/** Keycloak Admin REST API base (server-side). Uses internal Docker host when ADMIN_URL is localhost. */
export function getKeycloakAdminBaseUrl(): string {
  const internalOverride = process.env.KEYCLOAK_ADMIN_INTERNAL_URL?.replace(
    /\/$/,
    ""
  );
  if (internalOverride) return internalOverride;

  const internalHost = hostFromIssuer(getKeycloakInternalIssuer());
  const adminUrl = process.env.KEYCLOAK_ADMIN_URL?.replace(/\/$/, "");

  if (adminUrl) {
    const isLoopback =
      adminUrl.includes("://localhost") ||
      adminUrl.includes("://127.0.0.1");
    if (
      isLoopback &&
      internalHost &&
      !internalHost.includes("localhost") &&
      !internalHost.includes("127.0.0.1")
    ) {
      return internalHost;
    }
    return adminUrl;
  }

  return internalHost ?? "http://localhost:8080";
}

/** OIDC endpoints: browser uses public host; server-side token/userinfo use internal host (Docker). */
export function getKeycloakOidcEndpoints() {
  const publicIssuer = getKeycloakPublicIssuer();
  const internalIssuer = getKeycloakInternalIssuer();
  const connectPath = (issuer: string) =>
    `${issuer}/protocol/openid-connect`;
  return {
    issuer: publicIssuer,
    authorization: `${connectPath(publicIssuer)}/auth`,
    token: `${connectPath(internalIssuer)}/token`,
    userinfo: `${connectPath(internalIssuer)}/userinfo`,
    /** RP-initiated logout (browser redirect). */
    endSession: `${connectPath(publicIssuer)}/logout`,
  };
}

/** Keycloak OIDC logout URL (ends SSO session, then redirects back). */
export function buildKeycloakLogoutUrl(params: {
  idToken?: string;
  postLogoutRedirectUri: string;
  clientId?: string;
}): string {
  const url = new URL(
    `${getKeycloakPublicIssuer()}/protocol/openid-connect/logout`
  );
  const clientId =
    params.clientId ??
    process.env.KEYCLOAK_CLIENT_ID ??
    "renis-management";
  url.searchParams.set("client_id", clientId);
  if (params.idToken) {
    url.searchParams.set("id_token_hint", params.idToken);
  }
  url.searchParams.set("post_logout_redirect_uri", params.postLogoutRedirectUri);
  return url.toString();
}
