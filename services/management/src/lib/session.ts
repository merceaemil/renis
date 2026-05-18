import { getKeycloakInternalIssuer, getKeycloakPublicIssuer } from "@renis/core/keycloak-url";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { prisma, UserRole, UserStatus } from "@renis/database";

export type ApiSessionUser = {
  id: string;
  email: string;
  role: UserRole;
  institutionId: string | null;
  keycloakId: string;
};

const publicIssuer = getKeycloakPublicIssuer();
const jwks = createRemoteJWKSet(
  new URL(`${getKeycloakInternalIssuer()}/protocol/openid-connect/certs`)
);

export async function getApiUser(
  req: NextRequest
): Promise<ApiSessionUser | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const accessToken = header.slice(7).trim();
  if (!accessToken) return null;

  try {
    const { payload } = await jwtVerify(accessToken, jwks, {
      issuer: publicIssuer,
    });
    const sub = payload.sub;
    if (!sub) return null;

    const email =
      typeof payload.email === "string" ? payload.email : undefined;

    let dbUser = await prisma.user.findUnique({ where: { keycloakId: sub } });
    if (!dbUser && email) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        dbUser = await prisma.user.update({
          where: { id: byEmail.id },
          data: { keycloakId: sub },
        });
      }
    }

    if (!dbUser || dbUser.status !== UserStatus.ACTIVE) return null;

    return {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      institutionId: dbUser.institutionId,
      keycloakId: dbUser.keycloakId,
    };
  } catch {
    return null;
  }
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
