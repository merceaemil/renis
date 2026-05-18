import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@renis/core";
import { canManageStudents } from "@renis/core/permissions";
import { prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { institutionWhere } from "@/lib/scope";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional().nullable(),
  nameConsent: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageStudents(user.role)) return withCors(forbidden());

  const scope = institutionWhere(user);
  if (scope === null) return withCors(forbidden());

  const existing = await prisma.student.findFirst({
    where: { id, ...scope },
  });
  if (!existing) {
    return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return withCors(NextResponse.json({ error: "Invalid payload" }, { status: 400 }));
  }

  const updated = await prisma.student.update({
    where: { id },
    data: {
      ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
      ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
      ...(body.dateOfBirth !== undefined
        ? {
            dateOfBirth:
              body.dateOfBirth && body.dateOfBirth.length > 0
                ? new Date(body.dateOfBirth)
                : null,
          }
        : {}),
      ...(body.nameConsent !== undefined ? { nameConsent: body.nameConsent } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });

  await logAudit({
    action: "STUDENT_UPDATED",
    entityType: "Student",
    entityId: updated.id,
    actorEmail: user.email,
  });

  return withCors(NextResponse.json(updated));
}
