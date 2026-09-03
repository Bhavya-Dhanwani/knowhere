// Importing modules
import { Request, Response, NextFunction } from 'express';
import CourseMembershipDao from '../../shared/dao/courseMembership.dao.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import sanitizeMembership from '../../shared/sanitizers/membership.sanitizer.js';
import { COURSE_ROLES, CourseRole } from '../../shared/constants/roles.constants.js';

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
}

export default RbacController;
