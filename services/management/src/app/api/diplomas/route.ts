import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@renis/core";
import { canManageDiplomas } from "@renis/core/permissions";
import { DiplomaStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { institutionListWhere, resolveInstitutionId } from "@/lib/scope";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

const DIPLOMA_TYPES = ["BACHELOR", "MASTER", "DOCTORATE", "CERTIFICATE", "LICENCE"] as const;

const createSchema = z.object({
  studentId: z.string().uuid(),
  type: z.enum(DIPLOMA_TYPES).or(z.string().min(1)),
  programmeName: z.string().min(1).optional(),
  title: z.string().min(1),
  graduationYear: z.number().int().min(1950).max(2100),
  honors: z.string().optional().nullable(),
  institutionId: z.string().uuid().optional(),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageDiplomas(user.role)) return withCors(forbidden());

  const queryInstitutionId = req.nextUrl.searchParams.get("institutionId");
  const scope = institutionListWhere(user, queryInstitutionId);
  if (scope === null) return withCors(forbidden());

  const diplomas = await prisma.diploma.findMany({
    where: scope,
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentIdNumber: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return withCors(NextResponse.json(diplomas));
}

export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageDiplomas(user.role)) return withCors(forbidden());

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return withCors(NextResponse.json({ error: "Invalid payload" }, { status: 400 }));
  }

  const institutionId = resolveInstitutionId(user, body.institutionId);
  if (!institutionId) {
    return withCors(
      NextResponse.json(
        { error: "institutionId is required for this action." },
        { status: 400 }
      )
    );
  }

  const student = await prisma.student.findFirst({
    where: { id: body.studentId, institutionId, active: true },
  });
  if (!student) {
    return withCors(NextResponse.json({ error: "Student not found" }, { status: 404 }));
  }

  const enrollment = await prisma.programmeEnrollment.findFirst({
    where: { studentId: body.studentId, active: true },
    include: { programme: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const created = await prisma.diploma.create({
    data: {
      institutionId,
      studentId: body.studentId,
      type: body.type,
      programmeName: body.programmeName ?? enrollment?.programme.name ?? null,
      title: body.title,
      graduationYear: body.graduationYear,
      honors: body.honors ?? null,
      createdById: user.id,
      status: DiplomaStatus.DRAFT,
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentIdNumber: true,
        },
      },
    },
  });

  await logAudit({
    action: "DIPLOMA_CREATED",
    entityType: "Diploma",
    entityId: created.id,
    actorEmail: user.email,
  });

  return withCors(NextResponse.json(created, { status: 201 }));
}
