import { NextRequest, NextResponse } from "next/server";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { GradeStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { detectSessionAnomalies } from "@/lib/grade-anomalies";
import { loadGradeSessionGrid } from "@/lib/grade-session-grid";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewMinistryDashboard(user.role)) return withCors(forbidden());

  const session = await prisma.gradeSession.findFirst({
    where: { id, status: GradeStatus.SUBMITTED },
  });
  if (!session) {
    return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  const grid = await loadGradeSessionGrid(id);
  if (!grid) {
    return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  const studentLabels = new Map(
    grid.students.map((r) => [
      r.student.id,
      `${r.student.lastName}, ${r.student.firstName} (${r.student.studentIdNumber})`,
    ])
  );

  const rows = await prisma.grade.findMany({
    where: { sessionId: id },
    include: { subject: true },
  });
  const anomalies = detectSessionAnomalies(
    rows.map((g) => ({
      studentId: g.studentId,
      studentLabel: studentLabels.get(g.studentId),
      gradeObtained: g.gradeObtained != null ? Number(g.gradeObtained) : null,
      gradeMax: Number(g.gradeMax),
      coefficient: Number(g.subject.coefficient),
    }))
  );

  const flags = await prisma.auditLog.findMany({
    where: {
      entityType: "GradeSession",
      entityId: id,
      action: "GRADE_ANOMALY_FLAGGED",
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return withCors(
    NextResponse.json({
      session: grid.session,
      subjects: grid.subjects,
      students: grid.students,
      stats: grid.stats,
      anomalies,
      ministryFlags: flags.map((f) => ({
        at: f.createdAt,
        actorEmail: f.actorEmail,
        message: (f.metadata as { message?: string })?.message,
      })),
    })
  );
}
