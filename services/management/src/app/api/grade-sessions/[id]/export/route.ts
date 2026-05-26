import { NextRequest, NextResponse } from "next/server";
import { canManageGrades } from "@renis/core/permissions";
import { corsOptions, withCors } from "@/lib/cors";
import { gradeGridToCsv, gradeGridToXlsx } from "@/lib/grade-export";
import { loadGradeSessionGrid } from "@/lib/grade-session-grid";
import { sessionInstitutionFilter } from "@/lib/scope";
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

  const grid = await loadGradeSessionGrid(id, sessionInstitutionFilter(user));
  if (!grid) {
    return withCors(apiError("api.error.notFound", 404));
  }

  const base = `grades-${grid.session.programme.code}-${grid.session.academicYear}-${grid.session.semester}`;
  const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

  if (format === "xlsx" || format === "excel") {
    const buf = await gradeGridToXlsx(grid);
    return withCors(
      new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        },
      })
    );
  }

  const csv = gradeGridToCsv(grid);
  return withCors(
    new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
      },
    })
  );
}
