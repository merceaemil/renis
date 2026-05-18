import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@renis/core";
import { canManageGrades } from "@renis/core/permissions";
import { GradeStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { institutionWhere } from "@/lib/scope";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

const upsertSchema = z.object({
  grades: z.array(
    z.object({
      studentId: z.string().uuid(),
      subjectId: z.string().uuid(),
      gradeObtained: z.number().min(0).max(100).nullable(),
      gradeMax: z.number().positive().optional(),
    })
  ),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageGrades(user.role)) return withCors(forbidden());

  const scope = institutionWhere(user);
  if (scope === null) return withCors(forbidden());

  const session = await prisma.gradeSession.findFirst({
    where: { id: sessionId, ...scope },
  });
  if (!session) {
    return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }
  if (session.status !== GradeStatus.DRAFT) {
    return withCors(
      NextResponse.json({ error: "Session is not editable." }, { status: 409 })
    );
  }

  let body: z.infer<typeof upsertSchema>;
  try {
    body = upsertSchema.parse(await req.json());
  } catch {
    return withCors(NextResponse.json({ error: "Invalid payload" }, { status: 400 }));
  }

  const subjectIds = [...new Set(body.grades.map((g) => g.subjectId))];
  const studentIds = [...new Set(body.grades.map((g) => g.studentId))];

  const [subjects, students] = await Promise.all([
    prisma.subject.findMany({
      where: { id: { in: subjectIds }, programmeId: session.programmeId },
    }),
    prisma.student.findMany({
      where: { id: { in: studentIds }, institutionId: session.institutionId },
    }),
  ]);

  if (subjects.length !== subjectIds.length || students.length !== studentIds.length) {
    return withCors(
      NextResponse.json({ error: "Invalid student or subject." }, { status: 400 })
    );
  }

  const now = new Date();
  await prisma.$transaction(
    body.grades.map((row) =>
      prisma.grade.upsert({
        where: {
          sessionId_studentId_subjectId: {
            sessionId,
            studentId: row.studentId,
            subjectId: row.subjectId,
          },
        },
        create: {
          sessionId,
          studentId: row.studentId,
          subjectId: row.subjectId,
          gradeObtained: row.gradeObtained,
          gradeMax: row.gradeMax ?? 20,
          status: GradeStatus.DRAFT,
          enteredById: user.id,
        },
        update: {
          gradeObtained: row.gradeObtained,
          ...(row.gradeMax !== undefined ? { gradeMax: row.gradeMax } : {}),
          enteredById: user.id,
          updatedAt: now,
        },
      })
    )
  );

  await logAudit({
    action: "GRADES_UPDATED",
    entityType: "GradeSession",
    entityId: sessionId,
    actorEmail: user.email,
    metadata: { count: body.grades.length },
  });

  return withCors(NextResponse.json({ ok: true, count: body.grades.length }));
}
