import { UserRole } from "@renis/database";
import type { ApiSessionUser } from "@/lib/session";

/** Institution filter for Prisma queries; null means caller should return 403. */
export function institutionWhere(
  user: ApiSessionUser
): { institutionId: string } | Record<string, never> | null {
  if (user.role === UserRole.SUPER_ADMIN) return {};
  if (user.role === UserRole.INSTITUTION_ADMIN && user.institutionId) {
    return { institutionId: user.institutionId };
  }
  return null;
}

/** List filter: institution admin is fixed; super admin may narrow via query. */
export function institutionListWhere(
  user: ApiSessionUser,
  queryInstitutionId?: string | null
): { institutionId: string } | Record<string, never> | null {
  const base = institutionWhere(user);
  if (base === null) return null;
  if (user.role === UserRole.SUPER_ADMIN && queryInstitutionId) {
    return { institutionId: queryInstitutionId };
  }
  return base;
}

export function requireInstitutionId(user: ApiSessionUser): string | null {
  if (user.role === UserRole.INSTITUTION_ADMIN && user.institutionId) {
    return user.institutionId;
  }
  return null;
}

/** Institution for creates: institution admin uses their own; super admin must pass body. */
export function resolveInstitutionId(
  user: ApiSessionUser,
  bodyInstitutionId?: string | null
): string | null {
  if (user.role === UserRole.INSTITUTION_ADMIN && user.institutionId) {
    return user.institutionId;
  }
  if (user.role === UserRole.SUPER_ADMIN && bodyInstitutionId) {
    return bodyInstitutionId;
  }
  return null;
}

/** Grid/session load: optional institution filter for super admin only. */
export function sessionInstitutionFilter(
  user: ApiSessionUser,
  queryInstitutionId?: string | null
): string | undefined {
  if (user.role === UserRole.INSTITUTION_ADMIN) {
    return user.institutionId ?? undefined;
  }
  if (user.role === UserRole.SUPER_ADMIN && queryInstitutionId) {
    return queryInstitutionId;
  }
  return undefined;
}
