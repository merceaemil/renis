import ExcelJS from "exceljs";
import type { loadGradeSessionGrid } from "@/lib/grade-session-grid";

type Grid = NonNullable<Awaited<ReturnType<typeof loadGradeSessionGrid>>>;

export function gradeGridToCsv(grid: Grid): string {
  const escapeCsv = (value: string) => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const headers = [
    "student_id_number",
    "last_name",
    "first_name",
    ...grid.subjects.map((s) => s.code),
    "semester_average",
    "credits_validated",
    "annual_average",
  ];
  const lines = [headers.join(",")];

  for (const row of grid.students) {
    const cells = [
      escapeCsv(row.student.studentIdNumber),
      escapeCsv(row.student.lastName),
      escapeCsv(row.student.firstName),
      ...row.grades.map((g) =>
        g.gradeObtained !== null ? String(g.gradeObtained) : ""
      ),
      row.semesterAverage !== null ? String(row.semesterAverage) : "",
      String(row.creditsValidated),
      row.annualAverage !== null ? String(row.annualAverage) : "",
    ];
    lines.push(cells.join(","));
  }

  return lines.join("\n");
}

export async function gradeGridToXlsx(grid: Grid): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Grades");

  ws.addRow([
    "Student ID",
    "Last name",
    "First name",
    ...grid.subjects.map((s) => s.code),
    "Semester avg.",
    "Credits validated",
    "Annual avg.",
  ]);

  for (const row of grid.students) {
    ws.addRow([
      row.student.studentIdNumber,
      row.student.lastName,
      row.student.firstName,
      ...row.grades.map((g) => g.gradeObtained ?? ""),
      row.semesterAverage ?? "",
      row.creditsValidated,
      row.annualAverage ?? "",
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
