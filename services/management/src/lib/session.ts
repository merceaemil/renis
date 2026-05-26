import { getKeycloakInternalIssuer, getKeycloakPublicIssuer } from "@renis/core/keycloak-url";
import { tApi, type Locale } from "@renis/core";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma, UserRole, UserStatus } from "@renis/database";
import {
  LOCALE_COOKIE,
  isLocale,
  parseAcceptLanguage,
  type Locale as L,
} from "@/lib/i18n";
import { resolveLocaleFromRequest } from "@/lib/i18n/server";

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

export async function unauthorized(
  localeOrReq?: Locale | NextRequest
): Promise<NextResponse> {
  const locale = await resolveLocale(localeOrReq);
  return NextResponse.json(
    { error: tApi("api.error.unauthorized", locale) },
    { status: 401, headers: { "Content-Language": locale } }
  );
}

export async function forbidden(
  localeOrReq?: Locale | NextRequest
): Promise<NextResponse> {
  const locale = await resolveLocale(localeOrReq);
  return NextResponse.json(
    { error: tApi("api.error.forbidden", locale) },
    { status: 403, headers: { "Content-Language": locale } }
  );
}

export async function apiError(
  key: string,
  status: number,
  localeOrReq?: Locale | NextRequest,
  extra?: Record<string, unknown>
): Promise<NextResponse> {
  const locale = await resolveLocale(localeOrReq);
  return NextResponse.json(
    { error: tApi(key, locale), ...extra },
    { status, headers: { "Content-Language": locale } }
  );
}

async function resolveLocale(
  localeOrReq?: Locale | NextRequest
): Promise<Locale> {
  if (typeof localeOrReq === "string") return localeOrReq;
  if (localeOrReq) return resolveLocaleFromRequest(localeOrReq);
  // No explicit request — try the ambient request via next/headers.
  try {
    const cookieStore = await cookies();
    const cookieLang = cookieStore.get(LOCALE_COOKIE)?.value;
    if (cookieLang && isLocale(cookieLang)) return cookieLang as L;
    const headerStore = await headers();
    return parseAcceptLanguage(headerStore.get("accept-language"));
  } catch {
    return "en";
  }
}
