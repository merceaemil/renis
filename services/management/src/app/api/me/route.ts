import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const sessionUser = await getApiUser(req);
  if (!sessionUser) return withCors(unauthorized());

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      institution: { select: { id: true, name: true, code: true } },
    },
  });
  if (!user) return withCors(unauthorized());

  return withCors(
    NextResponse.json({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      institutionId: user.institutionId,
      keycloakId: user.keycloakId,
      institution: user.institution,
    })
  );
}
