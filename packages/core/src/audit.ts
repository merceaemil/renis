import { prisma } from "@renis/database";
import type { Prisma } from "@renis/database";

export async function logAudit(params: {
  action: string;
  entityType?: string;
  entityId?: string;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      actorEmail: params.actorEmail,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress,
    },
  });
}
