import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DEFAULT_GRADE_CLASSIFICATIONS,
  logAudit,
  parseGradeClassifications,
  resolveInstitutionBrandingUrls,
} from "@renis/core";
import { canConfigureInstitutionSettings } from "@renis/core/permissions";
import { prisma, UserRole } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

const classificationSchema = z.object({
  min: z.number().min(0).max(20),
  max: z.number().min(0).max(20),
  label: z.string().min(1).max(64),
});

const patchSchema = z.object({
  gradeClassifications: z.array(classificationSchema).min(1).max(20),
});

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
  if (!canConfigureInstitutionSettings(user.role)) return withCors(forbidden());
  if (!canAccessInstitution(user, id)) return withCors(forbidden());

  const institution = await prisma.institution.findUnique({ where: { id } });
  if (!institution) {
    return withCors(apiError("api.error.notFound", 404));
  }

  const branding = await resolveInstitutionBrandingUrls(institution);

  return withCors(
    NextResponse.json({
      id: institution.id,
      code: institution.code,
      name: institution.name,
      gradeClassifications: parseGradeClassifications(
        institution.gradeClassifications
      ),
      logoObjectKey: institution.logoObjectKey,
      signatureInstitutionObjectKey: institution.signatureInstitutionObjectKey,
      signatureMinistryObjectKey: institution.signatureMinistryObjectKey,
      ...branding,
      defaults: DEFAULT_GRADE_CLASSIFICATIONS,
    })
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canConfigureInstitutionSettings(user.role)) return withCors(forbidden());
  if (!canAccessInstitution(user, id)) return withCors(forbidden());

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return withCors(
        NextResponse.json({ error: e.errors[0]?.message ?? "Invalid payload" }, { status: 400 })
      );
    }
    return withCors(apiError("api.error.invalidPayload", 400));
  }

  const sorted = [...body.gradeClassifications].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]!.min > sorted[i]!.max) {
      return withCors(
        apiError("api.classifications.invalidBand", 400)
      );
    }
    if (i > 0 && sorted[i]!.min <= sorted[i - 1]!.max) {
      return withCors(
        apiError("api.classifications.overlappingBands", 400)
      );
    }
  }

  const updated = await prisma.institution.update({
    where: { id },
    data: { gradeClassifications: sorted },
  });

  await logAudit({
    action: "INSTITUTION_SETTINGS_UPDATED",
    entityType: "Institution",
    entityId: id,
    actorEmail: user.email,
  });

  return withCors(
    NextResponse.json({
      gradeClassifications: parseGradeClassifications(
        updated.gradeClassifications
      ),
    })
  );
}
