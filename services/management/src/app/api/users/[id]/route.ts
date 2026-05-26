import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  canManageUsers,
  logAudit,
  setKeycloakUserEnabled,
} from "@renis/core";
import { prisma, UserRole, UserStatus } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionUser = await getApiUser(req);
  if (!sessionUser) return withCors(unauthorized());
  if (!canManageUsers(sessionUser.role)) return withCors(forbidden());

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return withCors(apiError("api.error.notFound", 404));
  }

  if (
    sessionUser.role === UserRole.INSTITUTION_ADMIN &&
    target.institutionId !== sessionUser.institutionId
  ) {
    return withCors(forbidden());
  }

  if (target.id === sessionUser.id) {
    return withCors(apiError("api.users.cannotDeactivateSelf", 400));
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return withCors(apiError("api.error.invalidPayload", 400));
  }

  const status = body.status as UserStatus;
  await setKeycloakUserEnabled(target.keycloakId, status === UserStatus.ACTIVE);

  const updated = await prisma.user.update({
    where: { id },
    data: { status },
  });

  await logAudit({
    action: status === UserStatus.ACTIVE ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    entityType: "User",
    entityId: updated.id,
    actorEmail: sessionUser.email,
  });

  return withCors(NextResponse.json(updated));
}
