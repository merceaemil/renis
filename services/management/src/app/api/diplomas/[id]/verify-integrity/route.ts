import { NextRequest, NextResponse } from "next/server";
import { sha256Buffer } from "@renis/core";
import { canManageDiplomas } from "@renis/core/permissions";
import { prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { institutionWhere } from "@/lib/scope";
import { apiError, forbidden, getApiUser, unauthorized } from "@/lib/session";

export async function OPTIONS() {
  return corsOptions();
}

/** Compare uploaded PDF bytes to stored SHA-256 hash (spec §8). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageDiplomas(user.role)) return withCors(forbidden());

  const scope = institutionWhere(user);
  if (scope === null) return withCors(forbidden());

  const diploma = await prisma.diploma.findFirst({
    where: { id, ...scope },
    select: { pdfHash: true, status: true },
  });
  if (!diploma?.pdfHash) {
    return withCors(apiError("api.diplomas.noPublishedHash", 404));
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return withCors(
      apiError("api.diplomas.pdfRequired", 400)
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = sha256Buffer(buffer);
  const match = hash === diploma.pdfHash;

  return withCors(
    NextResponse.json({
      match,
      storedHash: diploma.pdfHash,
      computedHash: hash,
    })
  );
}
