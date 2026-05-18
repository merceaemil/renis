import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@renis/core";
import { canManageGrades } from "@renis/core/permissions";
import { prisma, UserRole } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

const enrollSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1),
  yearLevel: z.number().int().min(1).max(10).optional(),
});

export async function OPTIONS() {
  return corsOptions();
}

async function loadProgramme(id: string, user: { role: UserRole; institutionId: string | null }) {
  const where =
    user.role === UserRole.INSTITUTION_ADMIN && user.institutionId
      ? { id, institutionId: user.institutionId, active: true }
      : { id, active: true };
  return prisma.programme.findFirst({ where });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageGrades(user.role)) return withCors(forbidden());

  const programme = await loadProgramme(id, user);
  if (!programme) {
    return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  const enrollments = await prisma.programmeEnrollment.findMany({
    where: { programmeId: id, active: true },
    include: {
      student: {
        select: {
          id: true,
          studentIdNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { student: { lastName: "asc" } },
  });

  return withCors(
    NextResponse.json(
      enrollments.map((e) => ({
        id: e.id,
        yearLevel: e.yearLevel,
        student: e.student,
      }))
    )
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageGrades(user.role)) return withCors(forbidden());

  let body: z.infer<typeof enrollSchema>;
  try {
    body = enrollSchema.parse(await req.json());
  } catch {
    return withCors(NextResponse.json({ error: "Invalid payload" }, { status: 400 }));
  }

  const programme = await loadProgramme(id, user);
  if (!programme) {
    return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  const students = await prisma.student.findMany({
    where: {
      id: { in: body.studentIds },
      institutionId: programme.institutionId,
      active: true,
    },
    select: { id: true },
  });
  if (students.length !== body.studentIds.length) {
    return withCors(
      NextResponse.json({ error: "One or more students not found." }, { status: 400 })
    );
  }

  await prisma.$transaction(
    body.studentIds.map((studentId) =>
      prisma.programmeEnrollment.upsert({
        where: {
          studentId_programmeId: { studentId, programmeId: id },
        },
        create: {
          studentId,
          programmeId: id,
          yearLevel: body.yearLevel ?? null,
          active: true,
        },
        update: {
          active: true,
          ...(body.yearLevel !== undefined ? { yearLevel: body.yearLevel } : {}),
        },
      })
    )
  );

  await logAudit({
    action: "PROGRAMME_ENROLLMENT_UPDATED",
    entityType: "Programme",
    entityId: id,
    actorEmail: user.email,
    metadata: { studentCount: body.studentIds.length },
  });

  return withCors(NextResponse.json({ enrolled: body.studentIds.length }));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageGrades(user.role)) return withCors(forbidden());

  const studentId = req.nextUrl.searchParams.get("studentId");
  if (!studentId) {
    return withCors(
      NextResponse.json({ error: "studentId query required" }, { status: 400 })
    );
  }

  const programme = await loadProgramme(id, user);
  if (!programme) {
    return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  await prisma.programmeEnrollment.updateMany({
    where: { programmeId: id, studentId },
    data: { active: false },
  });

  return withCors(new NextResponse(null, { status: 204 }));
}
