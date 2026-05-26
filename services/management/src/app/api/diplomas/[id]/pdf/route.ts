import { NextRequest, NextResponse } from "next/server";
import { getSignedDownloadUrl } from "@renis/core";
import { canManageDiplomas, canViewMinistryDashboard } from "@renis/core/permissions";
import { DiplomaStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { institutionWhere } from "@/lib/scope";
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

  const canRead =
    canManageDiplomas(user.role) || canViewMinistryDashboard(user.role);
  if (!canRead) return withCors(forbidden());

  const scope =
    user.role === "MINISTRY_ADMIN" || user.role === "SUPER_ADMIN"
      ? {}
      : institutionWhere(user);
  if (scope === null) return withCors(forbidden());

  const diploma = await prisma.diploma.findFirst({
    where: { id, ...scope, status: DiplomaStatus.PUBLISHED },
  });
  if (!diploma?.pdfPath) {
    return withCors(
      apiError("api.diplomas.pdfNotAvailable", 404)
    );
  }

  try {
    const url = await getSignedDownloadUrl(diploma.pdfPath, 3600);
    return withCors(NextResponse.json({ url, expiresIn: 3600 }));
  } catch {
    return withCors(
      apiError("api.diplomas.downloadLinkFailed", 503)
    );
  }
}
