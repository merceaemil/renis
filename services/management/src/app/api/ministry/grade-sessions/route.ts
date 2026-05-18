import { NextRequest, NextResponse } from "next/server";
import {
  buildPaginatedResult,
  parsePaginationParams,
} from "@renis/core/pagination";
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

  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const sort = params.get("sort");
  const where = {
    status: GradeStatus.SUBMITTED,
    ...(q
      ? {
          OR: [
            { institution: { name: { contains: q, mode: "insensitive" as const } } },
            { institution: { code: { contains: q, mode: "insensitive" as const } } },
            { programme: { name: { contains: q, mode: "insensitive" as const } } },
            { programme: { code: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const { page, pageSize, skip, take } = parsePaginationParams(params);
  const orderBy =
    sort === "institution"
      ? [{ institution: { name: "asc" as const } }, { submittedAt: "desc" as const }]
      : { submittedAt: "desc" as const };

  const [total, sessions] = await Promise.all([
    prisma.gradeSession.count({ where }),
    prisma.gradeSession.findMany({
      where,
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
      orderBy,
      skip,
      take,
    }),
  ]);

  const items = sessions.map((session) => {
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

  return withCors(
    NextResponse.json(buildPaginatedResult(items, total, page, pageSize))
  );
}
