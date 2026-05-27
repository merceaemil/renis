import { getObjectDataUrl, resolveInstitutionBrandingDataUrls } from "@renis/core";
import { DiplomaStatus, prisma } from "@renis/database";
import QRCode from "qrcode";
import { renderDiplomaHtml, type DiplomaPdfData } from "@/lib/pdf/templates/diploma";
import { htmlToPdf } from "@/lib/pdf/html-to-pdf";
import { buildDiplomaVerifyUrl } from "@/lib/verify-url";

export async function resolveBrandingUrls(institution: {
  logoObjectKey: string | null;
  signatureInstitutionObjectKey: string | null;
  signatureMinistryObjectKey: string | null;
}) {
  const urls = await resolveInstitutionBrandingDataUrls(institution);
  const ministryLogoFromEnv = process.env.MINISTRY_LOGO_OBJECT_KEY
    ? await getObjectDataUrl(process.env.MINISTRY_LOGO_OBJECT_KEY)
    : null;

  return {
    institutionLogoUrl: urls.logoUrl,
    institutionSignatureUrl: urls.signatureInstitutionUrl,
    ministryLogoUrl: ministryLogoFromEnv,
    ministrySignatureUrl: urls.signatureMinistryUrl,
  };
}

export async function buildDiplomaPdfBuffer(
  diplomaId: string,
  options: { forcePublished?: boolean } = {}
) {
  const diploma = await prisma.diploma.findUnique({
    where: { id: diplomaId },
    include: { institution: true, student: true },
  });
  if (!diploma) throw new Error("Diploma not found");

  // During publish, the DB row is still SUBMITTED when we render — without
  // forcePublished the rendered PDF would carry the "preview" watermark and
  // that watermarked buffer is what gets stored in MinIO as the published PDF.
  const isPreview = options.forcePublished
    ? false
    : diploma.status !== DiplomaStatus.PUBLISHED;
  const hasRealCode = !!diploma.uniqueCode;

  if (
    !hasRealCode &&
    diploma.status !== DiplomaStatus.DRAFT &&
    diploma.status !== DiplomaStatus.SUBMITTED
  ) {
    throw new Error("Verification code missing for this diploma.");
  }

  const displayCode =
    diploma.uniqueCode ??
    (diploma.status === DiplomaStatus.DRAFT
      ? "Assigned when submitted"
      : "Pending publication");

  let verifyUrl = "—";
  let qrDataUrl = "";
  if (hasRealCode) {
    verifyUrl = buildDiplomaVerifyUrl(diploma.uniqueCode!);
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });
  }

  const holderName = `${diploma.student.firstName} ${diploma.student.lastName}`;
  const branding = await resolveBrandingUrls(diploma.institution);

  const html = renderDiplomaHtml({
    institutionName: diploma.institution.name,
    studentName: holderName,
    diplomaType: diploma.type,
    title: diploma.title,
    graduationYear: diploma.graduationYear,
    honors: diploma.honors,
    uniqueCode: displayCode,
    verifyUrl,
    qrDataUrl,
    publishedAt: new Date().toLocaleDateString("en-GB"),
    preview: isPreview,
    ...branding,
  });

  const pdf = await htmlToPdf(html);
  return { pdf, diploma, code: diploma.uniqueCode ?? displayCode };
}

export type { DiplomaPdfData };
