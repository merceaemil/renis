import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { canManageGrades } from "@renis/core/permissions";
import { GradeStatus } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { loadGradeSessionGrid } from "@/lib/grade-session-grid";
import { institutionWhere, sessionInstitutionFilter } from "@/lib/scope";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

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
  if (!canManageGrades(user.role)) return withCors(forbidden());

  const scope = institutionWhere(user);
  if (scope === null) return withCors(forbidden());

  const grid = await loadGradeSessionGrid(id, sessionInstitutionFilter(user));
  if (!grid) {
    return withCors(apiError("api.error.notFound", 404));
  }
  if (grid.session.status !== GradeStatus.DRAFT) {
    return withCors(
      apiError("api.gradeSessions.notEditable", 409)
    );
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Grades");

  const headerRow = [
    "student_id_number",
    "last_name",
    "first_name",
    ...grid.subjects.map((s) => s.code),
  ];
  sheet.addRow(headerRow);

  for (const row of grid.students) {
    sheet.addRow([
      row.student.studentIdNumber,
      row.student.lastName,
      row.student.firstName,
      ...grid.subjects.map((_, i) => row.grades[i]?.gradeObtained ?? ""),
    ]);
  }

  sheet.getRow(1).font = { bold: true };
  for (let c = 4; c <= headerRow.length; c++) {
    sheet.getColumn(c).numFmt = "0.00";
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const filename = `template-${grid.session.programme.code}-${grid.session.academicYear}-${grid.session.semester}.xlsx`;

  return withCors(
    new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  );
}
