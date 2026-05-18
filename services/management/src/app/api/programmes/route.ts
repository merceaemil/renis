import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@renis/core";
import { canManageGrades } from "@renis/core/permissions";
import { prisma, Semester } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { institutionListWhere, resolveInstitutionId } from "@/lib/scope";
import { paginatedQuery } from "@/lib/prisma-pagination";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

const subjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  credits: z.number().int().min(0).optional(),
  coefficient: z.number().positive().optional(),
  semester: z.nativeEnum(Semester),
  yearLevel: z.number().int().min(1).max(6),
});

const createSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1),
  subjects: z.array(subjectSchema).optional(),
  institutionId: z.string().uuid().optional(),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageGrades(user.role)) return withCors(forbidden());

  const queryInstitutionId = req.nextUrl.searchParams.get("institutionId");
  const scope = institutionListWhere(user, queryInstitutionId);
  if (scope === null) return withCors(forbidden());

  const result = await paginatedQuery(
    req.nextUrl.searchParams,
    prisma.programme,
    {
      where: { ...scope, active: true },
      include: { subjects: { orderBy: [{ yearLevel: "asc" }, { code: "asc" }] } },
      orderBy: { name: "asc" },
    }
  );

  return withCors(NextResponse.json(result));
}

export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageGrades(user.role)) return withCors(forbidden());

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return withCors(NextResponse.json({ error: "Invalid payload" }, { status: 400 }));
  }

  const institutionId = resolveInstitutionId(user, body.institutionId);
  if (!institutionId) {
    return withCors(
      NextResponse.json(
        { error: "institutionId is required for this action." },
        { status: 400 }
      )
    );
  }

  const existing = await prisma.programme.findUnique({
    where: {
      institutionId_code: { institutionId, code: body.code },
    },
  });
  if (existing) {
    return withCors(
      NextResponse.json({ error: "Programme code already exists." }, { status: 409 })
    );
  }

  const created = await prisma.programme.create({
    data: {
      institutionId,
      code: body.code,
      name: body.name,
      subjects: body.subjects?.length
        ? {
            create: body.subjects.map((s) => ({
              name: s.name,
              code: s.code,
              credits: s.credits ?? 0,
              coefficient: s.coefficient ?? 1,
              semester: s.semester,
              yearLevel: s.yearLevel,
            })),
          }
        : undefined,
    },
    include: { subjects: true },
  });

  await logAudit({
    action: "PROGRAMME_CREATED",
    entityType: "Programme",
    entityId: created.id,
    actorEmail: user.email,
  });

  return withCors(NextResponse.json(created, { status: 201 }));
}
