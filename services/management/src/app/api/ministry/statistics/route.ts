import { NextRequest, NextResponse } from "next/server";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { corsOptions, withCors } from "@/lib/cors";
import { paginateArray } from "@renis/core/pagination";
import { buildNationalStatistics } from "@/lib/national-statistics";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewMinistryDashboard(user.role)) return withCors(forbidden());

  const allRows = await buildNationalStatistics();
  const overall =
    allRows.length > 0
      ? {
          submittedSessions: allRows.length,
          totalStudents: allRows.reduce((s, r) => s + r.studentCount, 0),
          institutions: new Set(allRows.map((r) => r.institutionCode)).size,
        }
      : { submittedSessions: 0, totalStudents: 0, institutions: 0 };

  if (req.nextUrl.searchParams.get("all") === "true") {
    return withCors(NextResponse.json({ summary: overall, rows: allRows }));
  }

  const paginated = paginateArray(allRows, req.nextUrl.searchParams);
  return withCors(
    NextResponse.json({
      summary: overall,
      rows: paginated.items,
      total: paginated.total,
      page: paginated.page,
      pageSize: paginated.pageSize,
      totalPages: paginated.totalPages,
    })
  );
}
