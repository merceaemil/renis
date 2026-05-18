import type { Prisma } from "@renis/database";

export type AuditLogFilters = {
  action?: string;
  actionContains?: string;
  entityType?: string;
  actor?: string;
  entityId?: string;
  from?: string;
  to?: string;
};

export function parseAuditLogFilters(params: URLSearchParams): AuditLogFilters {
  const action = params.get("action")?.trim();
  const actionContains = params.get("actionContains")?.trim();
  return {
    action: action || undefined,
    actionContains: !action && actionContains ? actionContains : undefined,
    entityType: params.get("entityType")?.trim() || undefined,
    actor: params.get("actor")?.trim() || undefined,
    entityId: params.get("entityId")?.trim() || undefined,
    from: params.get("from")?.trim() || undefined,
    to: params.get("to")?.trim() || undefined,
  };
}

export function buildAuditLogWhere(
  filters: AuditLogFilters
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.action) {
    where.action = filters.action;
  } else if (filters.actionContains) {
    where.action = { contains: filters.actionContains, mode: "insensitive" };
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.actor) {
    where.actorEmail = { contains: filters.actor, mode: "insensitive" };
  }

  if (filters.entityId) {
    where.entityId = { contains: filters.entityId, mode: "insensitive" };
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) {
      where.createdAt.gte = new Date(filters.from);
    }
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  return where;
}

export function auditFiltersToSearchParams(
  filters: AuditLogFilters
): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.action) out.action = filters.action;
  if (filters.actionContains) out.actionContains = filters.actionContains;
  if (filters.entityType) out.entityType = filters.entityType;
  if (filters.actor) out.actor = filters.actor;
  if (filters.entityId) out.entityId = filters.entityId;
  if (filters.from) out.from = filters.from;
  if (filters.to) out.to = filters.to;
  return out;
}
