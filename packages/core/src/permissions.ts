import { UserRole } from "./roles";

export function canManageUsers(role?: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.INSTITUTION_ADMIN;
}

export function canAccessUserManagement(role?: UserRole): boolean {
  return canManageUsers(role);
}

export function canManageInstitutions(role?: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN;
}

export function canViewAuditLog(role?: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN;
}

/** Grade scales, logos, signatures (own institution or Super Admin). */
export function canConfigureInstitutionSettings(role?: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN || role === UserRole.INSTITUTION_ADMIN
  );
}

export function canManageStudents(role?: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN || role === UserRole.INSTITUTION_ADMIN
  );
}

export function canManageGrades(role?: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN || role === UserRole.INSTITUTION_ADMIN
  );
}

export function canManageDiplomas(role?: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN || role === UserRole.INSTITUTION_ADMIN
  );
}

/** Super Admin and Ministry Admin: cross-institution read-only views. */
export function canViewAllInstitutions(role?: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN || role === UserRole.MINISTRY_ADMIN
  );
}

export function canViewMinistryDashboard(role?: UserRole): boolean {
  return role === UserRole.MINISTRY_ADMIN || role === UserRole.SUPER_ADMIN;
}

export function canCreateRole(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  if (actorRole === UserRole.SUPER_ADMIN) return true;
  if (actorRole === UserRole.INSTITUTION_ADMIN) {
    return targetRole === UserRole.INSTITUTION_ADMIN;
  }
  return false;
}
