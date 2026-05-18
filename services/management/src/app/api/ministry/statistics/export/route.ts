import { NextRequest, NextResponse } from "next/server";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { corsOptions, withCors } from "@/lib/cors";
import {
  buildNationalStatistics,
  nationalStatisticsToCsv,
} from "@/lib/national-statistics";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewMinistryDashboard(user.role)) return withCors(forbidden());

  const rows = await buildNationalStatistics();
  const csv = nationalStatisticsToCsv(rows);

  return withCors(
    new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="national-statistics.csv"',
      },
    })
  );
}
