// Importing modules
import { Request, Response, NextFunction } from 'express';
import CourseMembershipDao from '../../shared/dao/courseMembership.dao.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import sanitizeMembership from '../../shared/sanitizers/membership.sanitizer.js';
import { COURSE_ROLES, CourseRole } from '../../shared/constants/roles.constants.js';
import BadRequest from '../../shared/errors/BadRequest.error.js';

// class to handle inter-service RBAC/ARBAC authorization queries
class RbacController {
  membershipDao: CourseMembershipDao;

  constructor() {
    this.membershipDao = new CourseMembershipDao();
  }

  // verify if a user has one of the allowed roles in a course (for inter-service calls e.g. courseService)
  verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, courseId, allowedRoles } = req.body;

      const membership = await this.membershipDao.findMembership(courseId, userId);

      if (!membership || membership.status !== 'active') {
        return Ok(res, 'User has no active membership in this course', {
          authorized: false,
          courseId,
          userId,
          role: null
        });
      }

      const hasRole = (allowedRoles as string[]).includes(membership.role);

      return Ok(res, hasRole ? 'User authorized' : 'User not authorized', {
        authorized: hasRole,
        courseId,
        userId,
        role: membership.role,
        status: membership.status
      });
    } catch (error) {
      next(error);
    }
  };

  // register initial admin when course is created in courseService
  registerInitialAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, userId } = req.body;

      if ((await this.membershipDao.countMembershipsInCourse(courseId)) > 0) {
        throw new BadRequest('Initial administrator has already been provisioned for this course.');
      }

      const membership = await this.membershipDao.assignMembership({
        courseId,
        userId,
        role: COURSE_ROLES.ADMIN as CourseRole,
        assignedBy: 'system:course-creation',
        status: 'active'
      });

      return Created(
        res,
        `Initial course admin assigned for course '${courseId}'`,
        sanitizeMembership(membership.toObject())
      );
    } catch (error) {
      next(error);
    }
  };

  listUserCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawUserId = req.params.userId;
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
      const memberships = await this.membershipDao.findCoursesByUser(userId, 'active');
      return Ok(res, 'Active course memberships retrieved', {
        courseIds: memberships.map((membership) => membership.courseId.toString())
      });
    } catch (error) {
      next(error);
    }
  };

  verifyAny = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, allowedRoles } = req.body as { userId?: string; allowedRoles?: string[] };
      if (!userId || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        throw new BadRequest('userId and allowedRoles are required.');
      }
      const membership = await this.membershipDao.findAnyActiveMembership(userId, allowedRoles);
      return Ok(res, membership ? 'User authorized' : 'User not authorized', {
        authorized: Boolean(membership),
        role: membership?.role || null,
        courseId: membership?.courseId || null
      });
    } catch (error) {
      next(error);
    }
  };
}

export default RbacController;
