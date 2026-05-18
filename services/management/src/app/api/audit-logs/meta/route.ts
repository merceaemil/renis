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

  const [actionRows, entityRows] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);

  return withCors(
    NextResponse.json({
      actions: actionRows.map((r) => r.action),
      entityTypes: entityRows
        .map((r) => r.entityType)
        .filter((t): t is string => Boolean(t)),
    })
  );
}
