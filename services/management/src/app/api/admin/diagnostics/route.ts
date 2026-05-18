import { NextRequest, NextResponse } from "next/server";
import { canManageInstitutions } from "@renis/core/permissions";
import { corsOptions, withCors } from "@/lib/cors";
import { gatherSystemDiagnostics } from "@/lib/system-diagnostics";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageInstitutions(user.role)) return withCors(forbidden());

  const data = await gatherSystemDiagnostics();
  return withCors(NextResponse.json(data));
}
