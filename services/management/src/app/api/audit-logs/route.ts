import { NextRequest, NextResponse } from "next/server";
import { canViewAuditLog } from "@renis/core/permissions";
import { prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewAuditLog(user.role)) return withCors(forbidden());

  const limit = Math.min(
    200,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 100))
  );
  const action = req.nextUrl.searchParams.get("action")?.trim();

  const logs = await prisma.auditLog.findMany({
    where: action ? { action } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return withCors(NextResponse.json(logs));
}
