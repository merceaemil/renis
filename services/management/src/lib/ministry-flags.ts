import { prisma } from "@renis/database";

export type MinistryFlagEntry = {
  at: string;
  actorEmail: string | null;
  message?: string;
};

export async function getMinistryGradeSessionFlags(
  sessionId: string
): Promise<MinistryFlagEntry[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      action: "GRADE_ANOMALY_FLAGGED",
      entityType: "GradeSession",
      entityId: sessionId,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return logs.map((log) => ({
    at: log.createdAt.toISOString(),
    actorEmail: log.actorEmail,
    message:
      log.metadata && typeof log.metadata === "object" && "message" in log.metadata
        ? String((log.metadata as { message: string }).message)
        : undefined,
  }));
}

export async function getMinistryDiplomaFlags(
  diplomaId: string
): Promise<MinistryFlagEntry[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      action: "DIPLOMA_ANOMALY_FLAGGED",
      entityType: "Diploma",
      entityId: diplomaId,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return logs.map((log) => ({
    at: log.createdAt.toISOString(),
    actorEmail: log.actorEmail,
    message:
      log.metadata && typeof log.metadata === "object" && "message" in log.metadata
        ? String((log.metadata as { message: string }).message)
        : undefined,
  }));
}
