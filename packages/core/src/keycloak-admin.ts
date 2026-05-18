/**
 * Keycloak Admin API — used by the Next.js app to create / deactivate accounts.
 * No self-registration: all accounts are provisioned from the management UI.
 */

import { getKeycloakAdminBaseUrl } from "./keycloak-url";

const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? "renis";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getAdminAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const base = getKeycloakAdminBaseUrl();
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: "admin-cli",
    username:
      process.env.KEYCLOAK_ADMIN_USER ?? process.env.KEYCLOAK_ADMIN ?? "admin",
    password: process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin",
  });

  const res = await fetch(
    `${base}/realms/master/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak admin token failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

export type KeycloakRoleName =
  | "super_admin"
  | "ministry_admin"
  | "institution_admin";

export interface CreateKeycloakUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: KeycloakRoleName;
  temporaryPassword?: string;
}

export async function createKeycloakUser(
  input: CreateKeycloakUserInput
): Promise<string> {
  const token = await getAdminAccessToken();
  const base = getKeycloakAdminBaseUrl();
  const tempPassword = input.temporaryPassword ?? generateTemporaryPassword();

  const createRes = await fetch(
    `${base}/admin/realms/${KEYCLOAK_REALM}/users`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: input.email,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        emailVerified: true,
        requiredActions: ["UPDATE_PASSWORD"],
        credentials: [
          {
            type: "password",
            value: tempPassword,
            temporary: true,
          },
        ],
      }),
    }
  );

  if (createRes.status === 409) {
    throw new Error("An account with this email already exists in Keycloak.");
  }
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Keycloak create user failed: ${createRes.status} ${text}`);
  }

  const location = createRes.headers.get("Location");
  if (!location) {
    throw new Error("Keycloak did not return user Location header");
  }
  const keycloakId = location.split("/").pop()!;

  await assignRealmRole(token, keycloakId, input.role);

  return keycloakId;
}

/** Single-use activation link (48h) via Keycloak execute-actions email. */
export async function sendKeycloakInvitationEmail(params: {
  keycloakUserId: string;
  redirectUri?: string;
  lifespanSeconds?: number;
}): Promise<void> {
  const token = await getAdminAccessToken();
  const base = getKeycloakAdminBaseUrl();
  const clientId = process.env.KEYCLOAK_CLIENT_ID ?? "renis-management";
  const redirectUri =
    params.redirectUri ??
    `${(process.env.MANAGEMENT_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "")}/login`;
  const lifespan = params.lifespanSeconds ?? 172_800;

  const url = new URL(
    `${base}/admin/realms/${KEYCLOAK_REALM}/users/${params.keycloakUserId}/execute-actions-email`
  );
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("lifespan", String(lifespan));

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["UPDATE_PASSWORD"]),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak invitation email failed: ${res.status} ${text}`);
  }
}

export async function setKeycloakUserEnabled(
  keycloakId: string,
  enabled: boolean
): Promise<void> {
  const token = await getAdminAccessToken();
  const base = getKeycloakAdminBaseUrl();

  const res = await fetch(
    `${base}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak update user failed: ${res.status} ${text}`);
  }
}

async function assignRealmRole(
  token: string,
  userId: string,
  roleName: KeycloakRoleName
): Promise<void> {
  const base = getKeycloakAdminBaseUrl();

  const roleRes = await fetch(
    `${base}/admin/realms/${KEYCLOAK_REALM}/roles/${roleName}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!roleRes.ok) {
    throw new Error(`Role ${roleName} not found in Keycloak`);
  }
  const role = await roleRes.json();

  const assignRes = await fetch(
    `${base}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([role]),
    }
  );

  if (!assignRes.ok) {
    const text = await assignRes.text();
    throw new Error(`Keycloak assign role failed: ${assignRes.status} ${text}`);
  }
}

function generateTemporaryPassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < 16; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export function roleToKeycloak(role: string): KeycloakRoleName {
  const map: Record<string, KeycloakRoleName> = {
    SUPER_ADMIN: "super_admin",
    MINISTRY_ADMIN: "ministry_admin",
    INSTITUTION_ADMIN: "institution_admin",
  };
  const kc = map[role];
  if (!kc) throw new Error(`Unknown role: ${role}`);
  return kc;
}
