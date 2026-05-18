import { NextRequest, NextResponse } from "next/server";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { corsOptions, withCors } from "@/lib/cors";
import { buildNationalStatistics } from "@/lib/national-statistics";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewMinistryDashboard(user.role)) return withCors(forbidden());

  const rows = await buildNationalStatistics();
  const overall =
    rows.length > 0
      ? {
          submittedSessions: rows.length,
          totalStudents: rows.reduce((s, r) => s + r.studentCount, 0),
          institutions: new Set(rows.map((r) => r.institutionCode)).size,
        }
      : { submittedSessions: 0, totalStudents: 0, institutions: 0 };

  return withCors(NextResponse.json({ summary: overall, rows }));
}
