import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@renis/core";
import { canManageStudents } from "@renis/core/permissions";
import { prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import {
  institutionListWhere,
  resolveInstitutionId,
} from "@/lib/scope";
import { paginatedQuery } from "@/lib/prisma-pagination";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

const createSchema = z.object({
  studentIdNumber: z.string().min(1).max(64),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional().nullable(),
  nameConsent: z.boolean().optional(),
  institutionId: z.string().uuid().optional(),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageStudents(user.role)) return withCors(forbidden());

  const queryInstitutionId = req.nextUrl.searchParams.get("institutionId");
  const scope = institutionListWhere(user, queryInstitutionId);
  if (scope === null) return withCors(forbidden());

  const result = await paginatedQuery(
    req.nextUrl.searchParams,
    prisma.student,
    {
      where: { ...scope, active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }
  );

  return withCors(NextResponse.json(result));
}

export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageStudents(user.role)) return withCors(forbidden());

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return withCors(apiError("api.error.invalidPayload", 400));
  }

  const institutionId = resolveInstitutionId(user, body.institutionId);
  if (!institutionId) {
    return withCors(apiError("api.error.institutionIdRequired", 400));
  }

  const existing = await prisma.student.findUnique({
    where: {
      institutionId_studentIdNumber: {
        institutionId,
        studentIdNumber: body.studentIdNumber,
      },
    },
  });
  if (existing) {
    return withCors(
      apiError("api.students.idExists", 409)
    );
  }

  const created = await prisma.student.create({
    data: {
      institutionId,
      studentIdNumber: body.studentIdNumber,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth:
        body.dateOfBirth && body.dateOfBirth.length > 0
          ? new Date(body.dateOfBirth)
          : null,
      nameConsent: body.nameConsent ?? false,
    },
  });

  await logAudit({
    action: "STUDENT_CREATED",
    entityType: "Student",
    entityId: created.id,
    actorEmail: user.email,
  });

  return withCors(NextResponse.json(created, { status: 201 }));
}
