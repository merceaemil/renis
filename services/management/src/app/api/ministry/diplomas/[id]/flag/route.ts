import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit, sendDiplomaAnomalyFlagEmail } from "@renis/core";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { DiplomaStatus, prisma, UserRole, UserStatus } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

const bodySchema = z.object({
  message: z.string().min(10).max(4000),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: diplomaId } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewMinistryDashboard(user.role)) return withCors(forbidden());

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return withCors(apiError("api.error.invalidPayload", 400));
  }

  const diploma = await prisma.diploma.findFirst({
    where: {
      id: diplomaId,
      status: {
        in: [DiplomaStatus.SUBMITTED, DiplomaStatus.PUBLISHED],
      },
    },
    include: {
      institution: true,
      student: true,
    },
  });
  if (!diploma) {
    return withCors(apiError("api.error.notFound", 404));
  }

  await logAudit({
    action: "DIPLOMA_ANOMALY_FLAGGED",
    entityType: "Diploma",
    entityId: diplomaId,
    actorEmail: user.email,
    metadata: { message: body.message, institutionId: diploma.institutionId },
  });

  const institutionAdmins = await prisma.user.findMany({
    where: {
      institutionId: diploma.institutionId,
      role: UserRole.INSTITUTION_ADMIN,
      status: UserStatus.ACTIVE,
    },
    select: { email: true },
  });

  const managementUrl =
    process.env.MANAGEMENT_PUBLIC_URL ?? "http://localhost:3000";

  try {
    await sendDiplomaAnomalyFlagEmail({
      to: institutionAdmins.map((u) => u.email),
      institutionName: diploma.institution.name,
      studentLabel: `${diploma.student.firstName} ${diploma.student.lastName}`,
      diplomaTitle: diploma.title,
      message: body.message,
      managementUrl,
    });
  } catch {
    // non-blocking
  }

  return withCors(NextResponse.json({ ok: true }));
}
