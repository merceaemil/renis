import { NextRequest, NextResponse } from "next/server";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { DiplomaStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";
import { getMinistryDiplomaFlags } from "@/lib/ministry-flags";

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
  if (!canViewMinistryDashboard(user.role)) return withCors(forbidden());

  const diploma = await prisma.diploma.findFirst({
    where: {
      id,
      status: {
        in: [
          DiplomaStatus.SUBMITTED,
          DiplomaStatus.PUBLISHED,
          DiplomaStatus.REVOKED,
        ],
      },
    },
    include: {
      institution: { select: { id: true, name: true, code: true } },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentIdNumber: true,
          dateOfBirth: true,
          nameConsent: true,
        },
      },
    },
  });

  if (!diploma) {
    return withCors(apiError("api.error.notFound", 404));
  }

  const ministryFlags = await getMinistryDiplomaFlags(id);

  return withCors(
    NextResponse.json({
      diploma: {
        id: diploma.id,
        status: diploma.status,
        uniqueCode: diploma.uniqueCode,
        type: diploma.type,
        title: diploma.title,
        graduationYear: diploma.graduationYear,
        honors: diploma.honors,
        submittedAt: diploma.submittedAt,
        publishedAt: diploma.publishedAt,
        revokedAt: diploma.revokedAt,
        hasPdf: !!diploma.pdfPath,
        institution: diploma.institution,
        student: diploma.student,
      },
      ministryFlags,
    })
  );
}
