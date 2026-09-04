export const COURSE_ROLES = {
  ADMIN: 'admin',
  TRAINER: 'trainer',
  TRAINEE: 'trainee'
} as const;

export type CourseRole = (typeof COURSE_ROLES)[keyof typeof COURSE_ROLES];

export const VALID_COURSE_ROLES: CourseRole[] = [
  COURSE_ROLES.ADMIN,
  COURSE_ROLES.TRAINER,
  COURSE_ROLES.TRAINEE
];

export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended'
} as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

/**
 * ARBAC Assignment Rules:
 * Defines which roles an actor with a given role can assign within the course.
 */
export const ARBAC_CAN_ASSIGN: Record<CourseRole, CourseRole[]> = {
  [COURSE_ROLES.ADMIN]: [COURSE_ROLES.ADMIN, COURSE_ROLES.TRAINER, COURSE_ROLES.TRAINEE],
  [COURSE_ROLES.TRAINER]: [],
  [COURSE_ROLES.TRAINEE]: []
};

/**
 * ARBAC Revocation Rules:
 * Defines which roles an actor with a given role can revoke within the course.
 */
export const ARBAC_CAN_REVOKE: Record<CourseRole, CourseRole[]> = {
  [COURSE_ROLES.ADMIN]: [COURSE_ROLES.ADMIN, COURSE_ROLES.TRAINER, COURSE_ROLES.TRAINEE],
  [COURSE_ROLES.TRAINER]: [],
  [COURSE_ROLES.TRAINEE]: []
};
