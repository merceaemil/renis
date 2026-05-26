import { NextRequest, NextResponse } from "next/server";
import {
  getSignedDownloadUrl,
  institutionAssetKey,
  logAudit,
  putObject,
} from "@renis/core";
import { canConfigureInstitutionSettings } from "@renis/core/permissions";
import { prisma, UserRole } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

const ASSETS = ["logo", "signature-institution", "signature-ministry"] as const;
type AssetKind = (typeof ASSETS)[number];

function canAccessInstitution(
  user: { role: UserRole; institutionId: string | null },
  institutionId: string
): boolean {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  if (user.role === UserRole.INSTITUTION_ADMIN) {
    return user.institutionId === institutionId;
  }
  return false;
}

function fieldForAsset(asset: AssetKind) {
  switch (asset) {
    case "logo":
      return "logoObjectKey" as const;
    case "signature-institution":
      return "signatureInstitutionObjectKey" as const;
    case "signature-ministry":
      return "signatureMinistryObjectKey" as const;
  }
}

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: institutionId } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canConfigureInstitutionSettings(user.role)) return withCors(forbidden());
  if (!canAccessInstitution(user, institutionId)) return withCors(forbidden());

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
  });
  if (!institution) {
    return withCors(apiError("api.error.notFound", 404));
  }

  const form = await req.formData();
  const asset = form.get("asset") as string | null;
  const file = form.get("file");

  if (!asset || !ASSETS.includes(asset as AssetKind)) {
    return withCors(apiError("api.branding.invalidAsset", 400));
  }
  if (!(file instanceof File) || file.size === 0) {
    return withCors(apiError("api.branding.fileRequired", 400));
  }
  if (file.size > 2 * 1024 * 1024) {
    return withCors(apiError("api.branding.maxFileSize", 400));
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/jpeg"
        ? "jpg"
        : file.name.split(".").pop()?.toLowerCase() ?? "png";
  if (!["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return withCors(
      apiError("api.branding.invalidImageType", 400)
    );
  }

  const key = institutionAssetKey(institutionId, asset as AssetKind, ext);
  const buffer = Buffer.from(await file.arrayBuffer());
  await putObject({
    key,
    body: buffer,
    contentType: file.type || "image/png",
  });

  const field = fieldForAsset(asset as AssetKind);
  await prisma.institution.update({
    where: { id: institutionId },
    data: { [field]: key },
  });

  await logAudit({
    action: "INSTITUTION_BRANDING_UPLOADED",
    entityType: "Institution",
    entityId: institutionId,
    actorEmail: user.email,
    metadata: { asset, key },
  });

  const previewUrl = await getSignedDownloadUrl(key, 3600);

  return withCors(NextResponse.json({ key, previewUrl }));
}
