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
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

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
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageUsers(user.role)) return withCors(forbidden());

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
  const sessionUser = await getApiUser(req);
  if (!sessionUser) return withCors(unauthorized());
  if (!canManageUsers(sessionUser.role)) return withCors(forbidden());

  let body: z.infer<typeof createUserSchema>;
  try {
    body = createUserSchema.parse(await req.json());
  } catch (e) {
    return withCors(
      NextResponse.json({ error: "Invalid payload", details: e }, { status: 400 })
    );
  }

  if (!canCreateRole(sessionUser.role, body.role)) {
    return withCors(
      NextResponse.json(
        { error: "You cannot create an account with this role." },
        { status: 403 }
      )
    );
  }

  if (body.role === UserRole.INSTITUTION_ADMIN && !body.institutionId) {
    return withCors(
      NextResponse.json(
        { error: "An institution is required for an institution admin." },
        { status: 400 }
      )
    );
  }

  if (body.role !== UserRole.INSTITUTION_ADMIN) {
    body.institutionId = null;
  }

  if (sessionUser.role === UserRole.INSTITUTION_ADMIN) {
    body.institutionId = sessionUser.institutionId ?? null;
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return withCors(
      NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      )
    );
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
    const message = err instanceof Error ? err.message : "Server error";
    return withCors(NextResponse.json({ error: message }, { status: 500 }));
  }
}
