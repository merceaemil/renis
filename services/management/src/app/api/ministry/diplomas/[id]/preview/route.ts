import { NextRequest, NextResponse } from "next/server";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { DiplomaStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { buildDiplomaPdfBuffer } from "@/lib/diploma-pdf";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

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
  });
  if (!diploma) {
    return withCors(apiError("api.error.notFound", 404));
  }

  try {
    const { pdf } = await buildDiplomaPdfBuffer(id);
    return withCors(
      new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="diploma-audit-${id}.pdf"`,
        },
      })
    );
  } catch (e) {
    return withCors(
      NextResponse.json(
        {
          error: e instanceof Error ? e.message : "Preview generation failed",
        },
        { status: 503 }
      )
    );
  }
}
