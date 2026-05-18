import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit, notifyMinistryDiplomaEvent } from "@renis/core";
import { verifyKeycloakUserPassword } from "@/lib/keycloak-token";
import { canManageDiplomas } from "@renis/core/permissions";
import { DiplomaStatus, prisma } from "@renis/database";
import { corsOptions, withCors } from "@/lib/cors";
import { publishDiplomaPdf } from "@/lib/diploma-publish";
import { institutionWhere } from "@/lib/scope";
import { forbidden, getApiUser, unauthorized } from "@/lib/session";

const DIPLOMA_TYPES = ["BACHELOR", "MASTER", "DOCTORATE", "CERTIFICATE", "LICENCE"] as const;

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("publish") }),
  z.object({
    action: z.literal("update"),
    type: z.enum(DIPLOMA_TYPES).or(z.string().min(1)).optional(),
    programmeName: z.string().min(1).optional().nullable(),
    title: z.string().min(1).optional(),
    graduationYear: z.number().int().min(1950).max(2100).optional(),
    honors: z.string().optional().nullable(),
  }),
  z.object({
    action: z.literal("revoke"),
    revocationReason: z
      .string()
      .trim()
      .min(100, "Revocation reason must be at least 100 characters."),
    password: z.string().min(1, "Password confirmation is required."),
  }),
]);

const studentInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentIdNumber: true,
    },
  },
  institution: { select: { name: true } },
} as const;

function studentLabel(d: {
  student: { firstName: string; lastName: string; studentIdNumber: string };
}) {
  return `${d.student.firstName} ${d.student.lastName} (${d.student.studentIdNumber})`;
}

export async function OPTIONS() {
  return corsOptions();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getApiUser(req);
  if (!user) return withCors(unauthorized());
  if (!canManageDiplomas(user.role)) return withCors(forbidden());

  const scope = institutionWhere(user);
  if (scope === null) return withCors(forbidden());

  const existing = await prisma.diploma.findFirst({
    where: { id, ...scope },
    include: studentInclude,
  });
  if (!existing) {
    return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      const message = e.errors[0]?.message ?? "Invalid payload";
      return withCors(NextResponse.json({ error: message }, { status: 400 }));
    }
    return withCors(NextResponse.json({ error: "Invalid payload" }, { status: 400 }));
  }

  const managementUrl =
    process.env.MANAGEMENT_PUBLIC_URL ?? "http://localhost:3000";

  if (body.action === "update") {
    if (existing.status !== DiplomaStatus.DRAFT) {
      return withCors(
        NextResponse.json(
          { error: "Only draft diplomas can be edited." },
          { status: 409 }
        )
      );
    }
    const updated = await prisma.diploma.update({
      where: { id },
      data: {
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.programmeName !== undefined
          ? { programmeName: body.programmeName }
          : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.graduationYear !== undefined
          ? { graduationYear: body.graduationYear }
          : {}),
        ...(body.honors !== undefined ? { honors: body.honors } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentIdNumber: true,
          },
        },
      },
    });
    await logAudit({
      action: "DIPLOMA_MODIFIED",
      entityType: "Diploma",
      entityId: updated.id,
      actorEmail: user.email,
    });
    return withCors(NextResponse.json(updated));
  }

  if (body.action === "publish") {
    if (existing.status !== DiplomaStatus.SUBMITTED) {
      return withCors(
        NextResponse.json(
          {
            error:
              "Only submitted diplomas can be published. Submit the draft first.",
          },
          { status: 409 }
        )
      );
    }
    if (!existing.uniqueCode) {
      return withCors(
        NextResponse.json(
          { error: "Verification code missing. Re-submit the diploma." },
          { status: 409 }
        )
      );
    }
    try {
      const updated = await publishDiplomaPdf(id);
      await logAudit({
        action: "DIPLOMA_PUBLISHED",
        entityType: "Diploma",
        entityId: updated.id,
        actorEmail: user.email,
      });
      await notifyMinistryDiplomaEvent({
        event: "published",
        institutionName: existing.institution.name,
        studentLabel: studentLabel(existing),
        diplomaTitle: existing.title,
        managementUrl,
      }).catch(() => undefined);
      return withCors(NextResponse.json(updated));
    } catch (e) {
      return withCors(
        NextResponse.json(
          {
            error:
              e instanceof Error ? e.message : "PDF generation or storage failed",
          },
          { status: 503 }
        )
      );
    }
  }

  let data: Parameters<typeof prisma.diploma.update>[0]["data"];
  let auditAction: string;

  switch (body.action) {
    case "submit":
      if (existing.status !== DiplomaStatus.DRAFT) {
        return withCors(
          NextResponse.json(
            { error: "Only draft diplomas can be submitted." },
            { status: 409 }
          )
        );
      }
      data = {
        status: DiplomaStatus.SUBMITTED,
        uniqueCode: randomUUID(),
        submittedAt: new Date(),
      };
      auditAction = "DIPLOMA_SUBMITTED";
      break;
    case "revoke":
      if (existing.status !== DiplomaStatus.PUBLISHED) {
        return withCors(
          NextResponse.json(
            { error: "Only published diplomas can be revoked." },
            { status: 409 }
          )
        );
      }
      {
        const valid = await verifyKeycloakUserPassword(
          user.email,
          body.password
        );
        if (!valid) {
          return withCors(
            NextResponse.json(
              { error: "Password confirmation failed." },
              { status: 403 }
            )
          );
        }
      }
      data = {
        status: DiplomaStatus.REVOKED,
        revokedAt: new Date(),
        revocationReason: body.revocationReason,
      };
      auditAction = "DIPLOMA_REVOKED";
      break;
  }

  const updated = await prisma.diploma.update({
    where: { id },
    data,
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentIdNumber: true,
        },
      },
    },
  });

  await logAudit({
    action: auditAction,
    entityType: "Diploma",
    entityId: updated.id,
    actorEmail: user.email,
    metadata: body.action === "revoke" ? { reason: body.revocationReason } : undefined,
  });

  await notifyMinistryDiplomaEvent({
    event: body.action === "submit" ? "submitted" : "revoked",
    institutionName: existing.institution.name,
    studentLabel: studentLabel(existing),
    diplomaTitle: existing.title,
    managementUrl,
    reason: body.action === "revoke" ? body.revocationReason : undefined,
  }).catch(() => undefined);

  return withCors(NextResponse.json(updated));
}
