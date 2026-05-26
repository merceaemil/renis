import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@renis/core";
import { canManageGrades } from "@renis/core/permissions";
import { GradeStatus, prisma, Semester } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { institutionListWhere } from "@/lib/scope";
import { UserRole } from "@renis/database";
import { paginatedQuery } from "@/lib/prisma-pagination";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

const createSchema = z.object({
  programmeId: z.string().uuid(),
  academicYear: z.string().min(4).max(16),
  semester: z.nativeEnum(Semester),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageGrades(user.role)) return withCors(forbidden());

  const queryInstitutionId = req.nextUrl.searchParams.get("institutionId");
  const scope = institutionListWhere(user, queryInstitutionId);
  if (scope === null) return withCors(forbidden());

  const result = await paginatedQuery(
    req.nextUrl.searchParams,
    prisma.gradeSession,
    {
      where: scope,
      include: {
        programme: { select: { id: true, code: true, name: true } },
        _count: { select: { grades: true } },
      },
      orderBy: { createdAt: "desc" },
    }
  );

  return withCors(NextResponse.json(result));
}

export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageGrades(user.role)) return withCors(forbidden());

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return withCors(apiError("api.error.invalidPayload", 400));
  }

  const programmeWhere =
    user.role === UserRole.INSTITUTION_ADMIN && user.institutionId
      ? { id: body.programmeId, institutionId: user.institutionId, active: true }
      : { id: body.programmeId, active: true };

  const programme = await prisma.programme.findFirst({
    where: programmeWhere,
  });
  if (!programme) {
    return withCors(apiError("api.programmes.notFound", 404));
  }

  const institutionId = programme.institutionId;

  const duplicate = await prisma.gradeSession.findUnique({
    where: {
      programmeId_academicYear_semester: {
        programmeId: body.programmeId,
        academicYear: body.academicYear,
        semester: body.semester,
      },
    },
  });
  if (duplicate) {
    if (duplicate.status === GradeStatus.SUBMITTED) {
      return withCors(
        NextResponse.json(
          {
            error:
              "A submitted session already exists for this programme, year, and semester.",
          },
          { status: 409 }
        )
      );
    }
    const existing = await prisma.gradeSession.findUnique({
      where: { id: duplicate.id },
      include: { programme: { select: { id: true, code: true, name: true } } },
    });
    return withCors(NextResponse.json(existing));
  }

  const created = await prisma.gradeSession.create({
    data: {
      institutionId,
      programmeId: body.programmeId,
      academicYear: body.academicYear,
      semester: body.semester,
      status: GradeStatus.DRAFT,
    },
    include: { programme: { select: { id: true, code: true, name: true } } },
  });

  await logAudit({
    action: "GRADE_SESSION_CREATED",
    entityType: "GradeSession",
    entityId: created.id,
    actorEmail: user.email,
  });

  return withCors(NextResponse.json(created, { status: 201 }));
}
