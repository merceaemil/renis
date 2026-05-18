import { NextRequest, NextResponse } from "next/server";
import { canViewMinistryDashboard } from "@renis/core/permissions";
import { DiplomaStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { paginatedQuery } from "@/lib/prisma-pagination";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canViewMinistryDashboard(user.role)) return withCors(forbidden());

  const statusParam = req.nextUrl.searchParams.get("status");
  const institutionId = req.nextUrl.searchParams.get("institutionId");

  const statusFilter =
    statusParam === "SUBMITTED"
      ? DiplomaStatus.SUBMITTED
      : statusParam === "PUBLISHED"
        ? DiplomaStatus.PUBLISHED
        : statusParam === "REVOKED"
          ? DiplomaStatus.REVOKED
          : undefined;

  const result = await paginatedQuery(
    req.nextUrl.searchParams,
    prisma.diploma,
    {
      where: {
        ...(statusFilter
          ? { status: statusFilter }
          : { status: { in: [DiplomaStatus.SUBMITTED, DiplomaStatus.PUBLISHED] } }),
        ...(institutionId ? { institutionId } : {}),
      },
      include: {
        institution: { select: { id: true, name: true, code: true } },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentIdNumber: true,
            nameConsent: true,
          },
        },
      },
      orderBy: [{ submittedAt: "desc" }, { publishedAt: "desc" }],
    }
  );

  if (Array.isArray(result)) {
    const payload = result.map(mapMinistryDiploma);
    return withCors(NextResponse.json(payload));
  }

  return withCors(
    NextResponse.json({
      ...result,
      items: result.items.map(mapMinistryDiploma),
    })
  );
}

function mapMinistryDiploma(d: {
  id: string;
  status: string;
  uniqueCode: string | null;
  type: string;
  title: string;
  graduationYear: number;
  honors: string | null;
  submittedAt: Date | null;
  publishedAt: Date | null;
  pdfPath: string | null;
  institution: { id: string; name: string; code: string };
  student: {
    firstName: string;
    lastName: string;
    studentIdNumber: string;
    nameConsent: boolean;
  };
}) {
  return {
    id: d.id,
    status: d.status,
    uniqueCode: d.uniqueCode,
    type: d.type,
    title: d.title,
    graduationYear: d.graduationYear,
    honors: d.honors,
    submittedAt: d.submittedAt,
    publishedAt: d.publishedAt,
    hasPdf: !!d.pdfPath,
    institution: d.institution,
    student: {
      studentIdNumber: d.student.studentIdNumber,
      displayName: d.student.nameConsent
        ? `${d.student.firstName} ${d.student.lastName}`
        : `${d.student.firstName.charAt(0)}.${d.student.lastName.charAt(0)}.`,
    },
  };
}
