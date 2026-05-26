import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@renis/core";
import { canManageGrades } from "@renis/core/permissions";
import { GradeStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { loadGradeSessionGrid } from "@/lib/grade-session-grid";
import { institutionWhere, sessionInstitutionFilter } from "@/lib/scope";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

type ImportError = { row: number; message: string };

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

  const grid = await loadGradeSessionGrid(
    sessionId,
    sessionInstitutionFilter(user)
  );
  if (!grid) {
    return withCors(apiError("api.error.notFound", 404));
  }
  if (grid.session.status !== GradeStatus.DRAFT) {
    return withCors(
      apiError("api.gradeSessions.notEditable", 409)
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return withCors(
      apiError("api.gradeSessions.missingFile", 400)
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return withCors(
      apiError("api.gradeSessions.emptySpreadsheet", 400)
    );
  }

  const headerValues = sheet.getRow(1).values as (string | number | undefined)[];
  const headers = headerValues
    .slice(1)
    .map((h) => String(h ?? "").trim().toLowerCase());

  const idCol = headers.indexOf("student_id_number");
  if (idCol < 0) {
    return withCors(
      apiError("api.gradeSessions.missingStudentColumn", 400)
    );
  }

  const subjectByCode = new Map(
    grid.subjects.map((s) => [s.code.toLowerCase(), s])
  );
  const subjectCols: { index: number; subjectId: string; code: string }[] = [];
  headers.forEach((h, i) => {
    const sub = subjectByCode.get(h);
    if (sub) subjectCols.push({ index: i, subjectId: sub.id, code: sub.code });
  });

  if (subjectCols.length === 0) {
    return withCors(
      apiError("api.gradeSessions.noSubjectColumns", 400)
    );
  }

  const studentByNumber = new Map(
    grid.students.map((r) => [r.student.studentIdNumber.toLowerCase(), r.student])
  );

  const errors: ImportError[] = [];
  const upserts: {
    studentId: string;
    subjectId: string;
    gradeObtained: number;
  }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as (string | number | undefined)[];
    const studentIdNumber = String(values[idCol + 1] ?? "").trim();
    if (!studentIdNumber) return;

    const student = studentByNumber.get(studentIdNumber.toLowerCase());
    if (!student) {
      errors.push({
        row: rowNumber,
        message: `Unknown student_id_number: ${studentIdNumber}`,
      });
      return;
    }

    for (const col of subjectCols) {
      const raw = values[col.index + 1];
      if (raw === undefined || raw === null || raw === "") continue;

      const grade = Number(raw);
      if (!Number.isFinite(grade) || grade < 0 || grade > 20) {
        errors.push({
          row: rowNumber,
          message: `Invalid grade for ${col.code} (must be 0–20): ${raw}`,
        });
        continue;
      }

      upserts.push({
        studentId: student.id,
        subjectId: col.subjectId,
        gradeObtained: grade,
      });
    }
  });

  if (upserts.length > 0) {
    await prisma.$transaction(
      upserts.map((row) =>
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
            status: GradeStatus.DRAFT,
            enteredById: user.id,
          },
          update: {
            gradeObtained: row.gradeObtained,
            enteredById: user.id,
          },
        })
      )
    );
  }

  await logAudit({
    action: "GRADES_IMPORTED",
    entityType: "GradeSession",
    entityId: sessionId,
    actorEmail: user.email,
    metadata: { accepted: upserts.length, rejected: errors.length },
  });

  return withCors(
    NextResponse.json({
      accepted: upserts.length,
      rejected: errors.length,
      errors,
    })
  );
}
