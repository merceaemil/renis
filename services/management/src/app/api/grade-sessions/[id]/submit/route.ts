import { NextRequest, NextResponse } from "next/server";
import { logAudit, sendGradeSubmissionEmail } from "@renis/core";
import { canManageGrades } from "@renis/core/permissions";
import { GradeStatus, prisma, UserRole } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { institutionWhere } from "@/lib/scope";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(
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
    include: {
      programme: true,
      institution: true,
      grades: { include: { subject: true } },
    },
  });
  if (!session) {
    return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }
  if (session.status !== GradeStatus.DRAFT) {
    return withCors(
      NextResponse.json({ error: "Session already submitted." }, { status: 409 })
    );
  }
  if (session.grades.length === 0) {
    return withCors(
      NextResponse.json({ error: "Enter at least one grade before submitting." }, { status: 400 })
    );
  }

  const submittedAt = new Date();
  await prisma.$transaction([
    prisma.gradeSession.update({
      where: { id: sessionId },
      data: { status: GradeStatus.SUBMITTED, submittedAt },
    }),
    prisma.grade.updateMany({
      where: { sessionId },
      data: { status: GradeStatus.SUBMITTED, submittedAt },
    }),
  ]);

  await logAudit({
    action: "GRADE_SESSION_SUBMITTED",
    entityType: "GradeSession",
    entityId: sessionId,
    actorEmail: user.email,
    metadata: {
      institutionId: session.institutionId,
      programmeId: session.programmeId,
      academicYear: session.academicYear,
      semester: session.semester,
    },
  });

  const ministryAdmins = await prisma.user.findMany({
    where: { role: UserRole.MINISTRY_ADMIN, status: "ACTIVE" },
    select: { email: true },
  });

  const managementUrl =
    process.env.MANAGEMENT_PUBLIC_URL ?? "http://localhost:3000";

  try {
    await sendGradeSubmissionEmail({
      to: ministryAdmins.map((u) => u.email),
      institutionName: session.institution.name,
      programmeName: session.programme.name,
      academicYear: session.academicYear,
      semester: session.semester,
      managementUrl,
    });
  } catch {
    // Non-blocking — submission still succeeds if SMTP is down
  }

  const updated = await prisma.gradeSession.findUnique({
    where: { id: sessionId },
    include: { programme: { select: { id: true, code: true, name: true } } },
  });

  return withCors(NextResponse.json(updated));
}
