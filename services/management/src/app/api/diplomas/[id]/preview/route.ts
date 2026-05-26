import { NextRequest, NextResponse } from "next/server";
import { canManageDiplomas } from "@renis/core/permissions";
import { DiplomaStatus } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { buildDiplomaPdfBuffer } from "@/lib/diploma-pdf";
import { institutionWhere } from "@/lib/scope";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";
import { prisma } from "@renis/database";

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
  if (!canManageDiplomas(user.role)) return withCors(forbidden());

  const scope = institutionWhere(user);
  if (scope === null) return withCors(forbidden());

  const diploma = await prisma.diploma.findFirst({
    where: {
      id,
      ...scope,
      status: {
        in: [
          DiplomaStatus.DRAFT,
          DiplomaStatus.SUBMITTED,
          DiplomaStatus.PUBLISHED,
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
          "Content-Disposition": `inline; filename="diploma-preview-${id}.pdf"`,
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
