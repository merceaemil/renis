import { NextResponse } from "next/server";
import { canManageUsers } from "@renis/core/permissions";
import { prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageUsers(user.role)) return withCors(forbidden());

  const [
    institutions,
    users,
    students,
    gradeSessions,
    diplomas,
    auditLogs,
    enrollments,
    transcriptRecords,
  ] = await Promise.all([
    prisma.institution.count(),
    prisma.user.count(),
    prisma.student.count({ where: { active: true } }),
    prisma.gradeSession.count(),
    prisma.diploma.count(),
    prisma.auditLog.count(),
    prisma.programmeEnrollment.count({ where: { active: true } }),
    prisma.transcriptRecord.count(),
  ]);

  let databaseOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseOk = false;
  }

  return withCors(
    NextResponse.json({
      version: process.env.npm_package_version ?? "0.1.0",
      environment: process.env.NODE_ENV ?? "development",
      database: { ok: databaseOk },
      counts: {
        institutions,
        users,
        students,
        gradeSessions,
        diplomas,
        auditLogs,
        enrollments,
        transcriptRecords,
      },
      services: {
        keycloakUrl: process.env.KEYCLOAK_URL ?? null,
        managementPublicUrl: process.env.MANAGEMENT_PUBLIC_URL ?? null,
        qrVerifyBaseUrl: `${(process.env.MANAGEMENT_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "")}/verify`,
      },
    })
  );
}
