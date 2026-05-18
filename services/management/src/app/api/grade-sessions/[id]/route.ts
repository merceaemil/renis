import { NextRequest, NextResponse } from "next/server";
import { canManageGrades } from "@renis/core/permissions";
import { corsOptions, withCors } from "@/lib/cors";
import { loadGradeSessionGrid } from "@/lib/grade-session-grid";
import { institutionWhere, sessionInstitutionFilter } from "@/lib/scope";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

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
    return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  return withCors(
    NextResponse.json({
      session: grid.session,
      subjects: grid.subjects,
      students: grid.students,
      stats: grid.stats,
    })
  );
}
