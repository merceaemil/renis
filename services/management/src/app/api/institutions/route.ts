import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@renis/core";
import { canManageInstitutions } from "@renis/core/permissions";
import { prisma, UserRole } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { paginatedQuery } from "@/lib/prisma-pagination";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

const createInstitutionSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(255),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());

  if (user.role === UserRole.SUPER_ADMIN) {
    const includeInactive = req.nextUrl.searchParams.get("all") === "true";
    const result = await paginatedQuery(
      req.nextUrl.searchParams,
      prisma.institution,
      {
        where: includeInactive ? undefined : { active: true },
        orderBy: { name: "asc" },
      }
    );
    return withCors(NextResponse.json(result));
  }

  if (user.institutionId) {
    const institution = await prisma.institution.findUnique({
      where: { id: user.institutionId },
    });
    return withCors(NextResponse.json(institution ? [institution] : []));
  }

  return withCors(NextResponse.json([]));
}

export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageInstitutions(user.role)) return withCors(forbidden());

  let body: z.infer<typeof createInstitutionSchema>;
  try {
    body = createInstitutionSchema.parse(await req.json());
  } catch (e) {
    return withCors(
      NextResponse.json({ error: "Invalid payload", details: e }, { status: 400 })
    );
  }

  const existing = await prisma.institution.findUnique({
    where: { code: body.code },
  });
  if (existing) {
    return withCors(
      NextResponse.json({ error: "Institution code already exists." }, { status: 409 })
    );
  }

  const created = await prisma.institution.create({
    data: { code: body.code.toUpperCase(), name: body.name, active: true },
  });

  await logAudit({
    action: "INSTITUTION_CREATED",
    entityType: "Institution",
    entityId: created.id,
    actorEmail: user.email,
    metadata: { code: created.code },
  });

  return withCors(NextResponse.json(created, { status: 201 }));
}
