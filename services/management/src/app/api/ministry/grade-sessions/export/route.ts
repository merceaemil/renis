import { NextRequest, NextResponse } from "next/server";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { GradeStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewMinistryDashboard(user.role)) return withCors(forbidden());

  const grades = await prisma.grade.findMany({
    where: { session: { status: GradeStatus.SUBMITTED } },
    include: {
      session: {
        include: {
          institution: { select: { code: true, name: true } },
          programme: { select: { code: true, name: true } },
        },
      },
      student: { select: { studentIdNumber: true, firstName: true, lastName: true } },
      subject: { select: { code: true, name: true } },
    },
    orderBy: [
      { session: { submittedAt: "desc" } },
      { student: { lastName: "asc" } },
    ],
  });

  const headers = [
    "institution_code",
    "institution_name",
    "programme_code",
    "academic_year",
    "semester",
    "submitted_at",
    "student_id_number",
    "student_last_name",
    "student_first_name",
    "subject_code",
    "subject_name",
    "grade_obtained",
    "grade_max",
  ];
  const lines = [headers.join(",")];

  for (const g of grades) {
    lines.push(
      [
        escapeCsv(g.session.institution.code),
        escapeCsv(g.session.institution.name),
        escapeCsv(g.session.programme.code),
        escapeCsv(g.session.academicYear),
        g.session.semester,
        g.session.submittedAt?.toISOString() ?? "",
        escapeCsv(g.student.studentIdNumber),
        escapeCsv(g.student.lastName),
        escapeCsv(g.student.firstName),
        escapeCsv(g.subject.code),
        escapeCsv(g.subject.name),
        g.gradeObtained !== null ? String(g.gradeObtained) : "",
        String(g.gradeMax),
      ].join(",")
    );
  }

  return withCors(
    new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="national-grades-audit.csv"',
      },
    })
  );
}
