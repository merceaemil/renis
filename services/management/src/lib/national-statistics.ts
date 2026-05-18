import { GradeStatus, prisma } from "@renis/database";
import { loadGradeSessionGrid } from "@/lib/grade-session-grid";

export type NationalStatRow = {
  institutionCode: string;
  institutionName: string;
  programmeCode: string;
  programmeName: string;
  academicYear: string;
  semester: string;
  studentCount: number;
  gradesEntered: number;
  sessionAverage: number | null;
};

export async function buildNationalStatistics(): Promise<NationalStatRow[]> {
  const sessions = await prisma.gradeSession.findMany({
    where: { status: GradeStatus.SUBMITTED },
    orderBy: [
      { academicYear: "desc" },
      { submittedAt: "desc" },
    ],
    select: { id: true },
  });

  const rows: NationalStatRow[] = [];

  for (const { id } of sessions) {
    const grid = await loadGradeSessionGrid(id);
    if (!grid) continue;

    const avgs = grid.students
      .map((r) => r.semesterAverage)
      .filter((a): a is number => a !== null);

    const sessionAverage =
      avgs.length > 0
        ? Math.round((avgs.reduce((sum, v) => sum + v, 0) / avgs.length) * 100) /
          100
        : null;

    rows.push({
      institutionCode: grid.session.institution.code,
      institutionName: grid.session.institution.name,
      programmeCode: grid.session.programme.code,
      programmeName: grid.session.programme.name,
      academicYear: grid.session.academicYear,
      semester: grid.session.semester,
      studentCount: grid.stats.studentCount,
      gradesEntered: grid.stats.filledCells,
      sessionAverage,
    });
  }

  return rows;
}

export function nationalStatisticsToCsv(rows: NationalStatRow[]): string {
  const header =
    "institution_code,institution_name,programme_code,programme_name,academic_year,semester,student_count,grades_entered,session_average";
  const lines = rows.map((r) =>
    [
      csvCell(r.institutionCode),
      csvCell(r.institutionName),
      csvCell(r.programmeCode),
      csvCell(r.programmeName),
      csvCell(r.academicYear),
      csvCell(r.semester),
      String(r.studentCount),
      String(r.gradesEntered),
      r.sessionAverage !== null ? String(r.sessionAverage) : "",
    ].join(",")
  );
  return [header, ...lines].join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
