// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';
import CourseMembershipDao from '../dao/courseMembership.dao.js';
import BadRequest from '../errors/BadRequest.error.js';
import Forbidden from '../errors/Forbidden.error.js';
import { CourseRole, ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE } from '../constants/roles.constants.js';

export interface CourseScopedRequest extends AuthenticatedRequest {
  courseId?: string;
  courseMembership?: {
    courseId: string;
    userId: string;
    role: CourseRole;
    status: string;
  };
}

const courseMembershipDao = new CourseMembershipDao();

/**
 * Extracts courseId from params, query, headers, or body
 */
export function extractCourseId(req: CourseScopedRequest): string | null {
  const fromParam = req.params?.courseId;
  if (fromParam) return Array.isArray(fromParam) ? fromParam[0] : fromParam;

  const fromHeader = req.headers?.['x-course-id'];
  if (typeof fromHeader === 'string' && fromHeader.trim().length > 0) {
    return fromHeader.trim();
  }

  const fromQuery = req.query?.courseId;
  if (typeof fromQuery === 'string' && fromQuery.trim().length > 0) {
    return fromQuery.trim();
  }

  const fromBody = req.body?.courseId;
  if (typeof fromBody === 'string' && fromBody.trim().length > 0) {
    return fromBody.trim();
  }

  return null;
}

/**
 * Multi-tenant ARBAC Middleware:
 * Enforces that the authenticated user has an active membership in the specified course
 * and possesses one of the allowed roles for that course.
 */
export function requireCourseRole(allowedRoles: CourseRole[]) {
  return async (req: CourseScopedRequest, res: Response, next: NextFunction) => {
    try {
      const courseId = extractCourseId(req);
      if (!courseId) {
        throw new BadRequest('Course ID is required to access course-scoped resource.');
      }

      if (!req.user?.userId) {
        throw new Forbidden('User unauthenticated.');
      }

      const membership = await courseMembershipDao.findMembership(courseId, req.user.userId);

      if (!membership || membership.status !== 'active') {
        throw new Forbidden(
          `Access denied: You have no active membership in course '${courseId}'.`
        );
      }

      const userRole = membership.role as CourseRole;

      if (!allowedRoles.includes(userRole)) {
        throw new Forbidden(
          `Access denied: Role '${userRole}' is not authorized for this action in course '${courseId}'.`
        );
      }

      // attach course membership context to request
      req.courseId = courseId;
      req.courseMembership = {
        courseId: membership.courseId,
        userId: membership.userId,
        role: userRole,
        status: membership.status
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * ARBAC Helper: Checks if actorRole can assign targetRole
 */
export function checkArbacCanAssign(actorRole: CourseRole, targetRole: CourseRole): boolean {
  const allowed = ARBAC_CAN_ASSIGN[actorRole] || [];
  return allowed.includes(targetRole);
}

/**
 * ARBAC Helper: Checks if actorRole can revoke targetRole
 */
export function checkArbacCanRevoke(actorRole: CourseRole, targetRole: CourseRole): boolean {
  const allowed = ARBAC_CAN_REVOKE[actorRole] || [];
  return allowed.includes(targetRole);
}

export default requireCourseRole;
