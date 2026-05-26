import { NextRequest, NextResponse } from "next/server";
import {
  classifyAverage,
  parseGradeClassifications,
  resolveInstitutionBrandingDataUrls,
  toNumber,
} from "@renis/core";
import { canManageGrades } from "@renis/core/permissions";
import { GradeStatus, prisma } from "@renis/database";
import QRCode from "qrcode";
import { corsOptions, withCors } from "@/lib/cors";
import { loadGradeSessionGrid } from "@/lib/grade-session-grid";
import { sessionInstitutionFilter } from "@/lib/scope";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";
import { htmlToPdf } from "@/lib/pdf/html-to-pdf";
import { renderTranscriptHtml } from "@/lib/pdf/templates/transcript";
import {
  buildTranscriptVerifyUrl,
  ensureTranscriptVerificationCode,
} from "@/lib/transcript-verify";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const { id: sessionId, studentId } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageGrades(user.role)) return withCors(forbidden());

  const grid = await loadGradeSessionGrid(
    sessionId,
    sessionInstitutionFilter(user)
  );
  if (!grid || grid.session.status !== GradeStatus.SUBMITTED) {
    return withCors(apiError("api.gradeSessions.notSubmittedOrNotFound", 404));
  }

  const row = grid.students.find((s) => s.student.id === studentId);
  if (!row) {
    return withCors(apiError("api.students.notFound", 404));
  }

  const verifyCode = await ensureTranscriptVerificationCode(
    grid.session.institutionId,
    studentId,
    sessionId
  );
  const verifyUrl = buildTranscriptVerifyUrl(verifyCode);
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 });

  const subjects = grid.subjects.map((sub, i) => {
    const g = row.grades[i];
    return {
      code: sub.code,
      name: sub.name,
      grade: g?.gradeObtained !== null ? String(g.gradeObtained) : "—",
      coefficient: toNumber(sub.coefficient) ?? 1,
    };
  });

  const institution = await prisma.institution.findUnique({
    where: { id: grid.session.institutionId },
    select: {
      gradeClassifications: true,
      logoObjectKey: true,
      signatureInstitutionObjectKey: true,
      signatureMinistryObjectKey: true,
    },
  });
  const branding = institution
    ? await resolveInstitutionBrandingDataUrls(institution)
    : { logoUrl: null, signatureInstitutionUrl: null, signatureMinistryUrl: null };
  const rules = parseGradeClassifications(institution?.gradeClassifications);
  const avg = row.semesterAverage;
  const classification = classifyAverage(avg, rules);

  const html = renderTranscriptHtml({
    institutionName: grid.session.institution.name,
    programmeName: grid.session.programme.name,
    academicYear: grid.session.academicYear,
    semester: grid.session.semester,
    studentName: `${row.student.firstName} ${row.student.lastName}`,
    studentIdNumber: row.student.studentIdNumber,
    subjects,
    semesterAverage:
      row.semesterAverage !== null ? String(row.semesterAverage) : "—",
    classification,
    verifyUrl,
    qrDataUrl,
    generatedAt: new Date().toLocaleString("en-GB"),
    institutionLogoUrl: branding.logoUrl,
  });

  try {
    const pdf = await htmlToPdf(html);
    const filename = `transcript-${row.student.studentIdNumber}-${grid.session.academicYear}.pdf`;
    return withCors(
      new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    );
  } catch (e) {
    return withCors(
      NextResponse.json(
        {
          error:
            e instanceof Error ? e.message : "PDF generation failed",
        },
        { status: 503 }
      )
    );
  }
}
