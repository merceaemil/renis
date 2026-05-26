import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  canCreateRole,
  canManageUsers,
  createKeycloakUser,
  logAudit,
  roleToKeycloak,
  sendKeycloakInvitationEmail,
} from "@renis/core";
import { prisma, UserRole, UserStatus } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { paginatedQuery } from "@/lib/prisma-pagination";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";
import { resolveLocaleFromRequest } from "@/lib/i18n/server";

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(UserRole),
  institutionId: z.string().uuid().optional().nullable(),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const locale = resolveLocaleFromRequest(req);
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized(locale));
  if (!canManageUsers(user.role)) return withCors(forbidden(locale));

  const where =
    user.role === UserRole.SUPER_ADMIN
      ? {}
      : { institutionId: user.institutionId ?? undefined };

  const result = await paginatedQuery(req.nextUrl.searchParams, prisma.user, {
    where,
    include: {
      institution: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return withCors(NextResponse.json(result));
}

export async function POST(req: NextRequest) {
  const locale = resolveLocaleFromRequest(req);
  const sessionUser = await getApiUser(req);
  if (!sessionUser) return withCors(unauthorized(locale));
  if (!canManageUsers(sessionUser.role)) return withCors(forbidden(locale));

  let body: z.infer<typeof createUserSchema>;
  try {
    body = createUserSchema.parse(await req.json());
  } catch (e) {
    return withCors(apiError("api.error.invalidPayload", 400, locale, { details: e }));
  }

  if (!canCreateRole(sessionUser.role, body.role)) {
    return withCors(apiError("api.users.cannotCreateRole", 403, locale));
  }

  if (body.role === UserRole.INSTITUTION_ADMIN && !body.institutionId) {
    return withCors(apiError("api.users.institutionRequired", 400, locale));
  }

  if (body.role !== UserRole.INSTITUTION_ADMIN) {
    body.institutionId = null;
  }

  if (sessionUser.role === UserRole.INSTITUTION_ADMIN) {
    body.institutionId = sessionUser.institutionId ?? null;
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return withCors(apiError("api.users.emailExists", 409, locale));
  }

  try {
    const keycloakId = await createKeycloakUser({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      role: roleToKeycloak(body.role),
    });

    const created = await prisma.user.create({
      data: {
        keycloakId,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        institutionId: body.institutionId,
        createdById: sessionUser.id,
        status: UserStatus.ACTIVE,
      },
      include: { institution: true },
    });

    await sendKeycloakInvitationEmail({ keycloakUserId: keycloakId });

    await logAudit({
      action: "USER_CREATED",
      entityType: "User",
      entityId: created.id,
      actorEmail: sessionUser.email,
      metadata: { email: created.email, role: created.role },
    });

    return withCors(NextResponse.json(created, { status: 201 }));
  } catch (err) {
    if (err instanceof Error) {
      return withCors(
        NextResponse.json(
          { error: err.message },
          { status: 500, headers: { "Content-Language": locale } }
        )
      );
    }
    return withCors(apiError("api.error.serverError", 500, locale));
  }
}
