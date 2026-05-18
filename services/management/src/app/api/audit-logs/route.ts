import { NextRequest, NextResponse } from "next/server";
import { canViewAuditLog } from "@renis/core/permissions";
import { prisma } from "@renis/database";
import {
  buildAuditLogWhere,
  parseAuditLogFilters,
} from "@/lib/audit-log-query";
import { corsOptions, withCors } from "@/lib/cors";
import { paginatedQuery } from "@/lib/prisma-pagination";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewAuditLog(user.role)) return withCors(forbidden());

  const filters = parseAuditLogFilters(req.nextUrl.searchParams);
  const where = buildAuditLogWhere(filters);

  const result = await paginatedQuery(
    req.nextUrl.searchParams,
    prisma.auditLog,
    {
      where,
      orderBy: { createdAt: "desc" },
    }
  );

  return withCors(NextResponse.json(result));
}
