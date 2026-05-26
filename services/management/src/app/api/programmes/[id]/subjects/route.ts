import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@renis/core";
import { canManageGrades } from "@renis/core/permissions";
import { prisma, Semester } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { institutionWhere } from "@/lib/scope";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

const subjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  credits: z.number().int().min(0).optional(),
  coefficient: z.number().positive().optional(),
  semester: z.nativeEnum(Semester),
  yearLevel: z.number().int().min(1).max(6),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programmeId } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageGrades(user.role)) return withCors(forbidden());

  const scope = institutionWhere(user);
  if (scope === null) return withCors(forbidden());

  const programme = await prisma.programme.findFirst({
    where: { id: programmeId, ...scope, active: true },
  });
  if (!programme) {
    return withCors(apiError("api.error.notFound", 404));
  }

  let body: z.infer<typeof subjectSchema>;
  try {
    body = subjectSchema.parse(await req.json());
  } catch {
    return withCors(apiError("api.error.invalidPayload", 400));
  }

  const created = await prisma.subject.create({
    data: {
      programmeId,
      name: body.name,
      code: body.code,
      credits: body.credits ?? 0,
      coefficient: body.coefficient ?? 1,
      semester: body.semester,
      yearLevel: body.yearLevel,
    },
  });

  await logAudit({
    action: "SUBJECT_CREATED",
    entityType: "Subject",
    entityId: created.id,
    actorEmail: user.email,
  });

  return withCors(NextResponse.json(created, { status: 201 }));
}
