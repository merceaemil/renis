import { NextRequest, NextResponse } from "next/server";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { GradeStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { detectSessionAnomalies } from "@/lib/grade-anomalies";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewMinistryDashboard(user.role)) return withCors(forbidden());

  const sessions = await prisma.gradeSession.findMany({
    where: { status: GradeStatus.SUBMITTED },
    include: {
      institution: { select: { id: true, name: true, code: true } },
      programme: { select: { id: true, code: true, name: true } },
      grades: {
        include: {
          subject: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentIdNumber: true,
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const payload = sessions.map((session) => {
    const rows = session.grades.map((g) => ({
      studentId: g.studentId,
      studentLabel: `${g.student.lastName}, ${g.student.firstName} (${g.student.studentIdNumber})`,
      gradeObtained: g.gradeObtained != null ? Number(g.gradeObtained) : null,
      gradeMax: Number(g.gradeMax),
      coefficient: Number(g.subject.coefficient),
    }));
    const anomalies = detectSessionAnomalies(rows);
    return {
      id: session.id,
      academicYear: session.academicYear,
      semester: session.semester,
      submittedAt: session.submittedAt,
      institution: session.institution,
      programme: session.programme,
      gradeCount: session.grades.length,
      anomalies,
    };
  });

  return withCors(NextResponse.json(payload));
}
