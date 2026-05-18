/** Mirrors Prisma `UserRole` — shared by UI and API without pulling in Prisma. */
export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  MINISTRY_ADMIN: "MINISTRY_ADMIN",
  INSTITUTION_ADMIN: "INSTITUTION_ADMIN",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
