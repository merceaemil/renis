import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit, sendAnomalyFlagEmail } from "@renis/core";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { GradeStatus, prisma, UserRole, UserStatus } from "@renis/database";
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
  const { id: sessionId } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewMinistryDashboard(user.role)) return withCors(forbidden());

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return withCors(apiError("api.error.invalidPayload", 400));
  }

  const session = await prisma.gradeSession.findFirst({
    where: { id: sessionId, status: GradeStatus.SUBMITTED },
    include: {
      programme: true,
      institution: true,
    },
  });
  if (!session) {
    return withCors(apiError("api.error.notFound", 404));
  }

  await logAudit({
    action: "GRADE_ANOMALY_FLAGGED",
    entityType: "GradeSession",
    entityId: sessionId,
    actorEmail: user.email,
    metadata: { message: body.message, institutionId: session.institutionId },
  });

  const institutionAdmins = await prisma.user.findMany({
    where: {
      institutionId: session.institutionId,
      role: UserRole.INSTITUTION_ADMIN,
      status: UserStatus.ACTIVE,
    },
    select: { email: true },
  });

  const managementUrl =
    process.env.MANAGEMENT_PUBLIC_URL ?? "http://localhost:3000";

  try {
    await sendAnomalyFlagEmail({
      to: institutionAdmins.map((u) => u.email),
      institutionName: session.institution.name,
      programmeName: session.programme.name,
      academicYear: session.academicYear,
      semester: session.semester,
      message: body.message,
      managementUrl,
    });
  } catch {
    // non-blocking
  }

  return withCors(NextResponse.json({ ok: true }));
}
