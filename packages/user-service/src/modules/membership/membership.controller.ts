// Importing modules
import { Response, NextFunction } from 'express';
import {
  CourseScopedRequest,
  checkArbacCanAssign,
  checkArbacCanRevoke
} from '../../shared/middlewares/arbac.middleware.js';
import CourseMembershipDao from '../../shared/dao/courseMembership.dao.js';
import UserProfileDao from '../../shared/dao/userProfile.dao.js';
import sanitizeMembership from '../../shared/sanitizers/membership.sanitizer.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import BadRequest from '../../shared/errors/BadRequest.error.js';
import { CourseRole, COURSE_ROLES } from '../../shared/constants/roles.constants.js';

function getParam(param: string | string[] | undefined, fallback: string = ''): string {
  if (Array.isArray(param)) return param[0] || fallback;
  return param || fallback;
}

// class to handle course membership operations
class MembershipController {
  membershipDao: CourseMembershipDao;

  constructor() {
    this.membershipDao = new CourseMembershipDao();
  }

  // DELETE /api/memberships/courses/:courseId — course-service, when a course is deleted
  removeCourse = async (req: CourseScopedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId.startsWith('service:')) {
        throw new Forbidden('Only the course service can remove a whole course.');
      }
      const courseId = getParam(req.params.courseId);
      const { deletedCount } = await this.membershipDao.removeAllForCourse(courseId);
      return Ok(res, 'Course memberships removed', { courseId, removed: deletedCount });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/memberships/overview — platform admins: newest enrollments + learners per course
  overview = async (req: CourseScopedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.role !== 'admin')
        throw new Forbidden('Only platform admins can view the overview.');
      const [recent, perCourse] = await Promise.all([
        this.membershipDao.findRecentMemberships(8),
        this.membershipDao.countLearnersByCourse()
      ]);
      const names = new Map(
        (await new UserProfileDao().findProfilesByUserIds(recent.map((m) => m.userId))).map((p) => [
          p.userId,
          p.name
        ])
      );
      return Ok(res, 'Enrollment overview', {
        recent: recent.map((m) => ({
          userId: m.userId,
          name: names.get(m.userId) || 'Unknown user',
          courseId: m.courseId,
          role: m.role,
          assignedAt: m.assignedAt
        })),
        learnersByCourse: perCourse.map((c) => ({ courseId: c._id, learners: c.count })),
        totalLearnerEnrollments: perCourse.reduce((n, c) => n + c.count, 0)
      });
    } catch (error) {
      next(error);
    }
  };

  // get caller's own role and permissions in the specified course
  getMyCourseRole = async (req: CourseScopedRequest, res: Response, next: NextFunction) => {
    try {
      const courseId = getParam(req.params.courseId, req.courseId);
      const userId = req.user!.userId;

      const membership = await this.membershipDao.findMembership(courseId, userId);

      if (!membership || membership.status !== 'active') {
        throw new NotFound(`You do not have active membership in course '${courseId}'.`);
      }

      return Ok(
        res,
        'Course role retrieved successfully',
        sanitizeMembership(membership.toObject())
      );
    } catch (error) {
      next(error);
    }
  };

  // list all members of a course (accessible to course admin and trainer)
  listMembers = async (req: CourseScopedRequest, res: Response, next: NextFunction) => {
    try {
      const courseId = getParam(req.params.courseId, req.courseId);
      const roleFilter = req.query.role as string | undefined;

      const members = await this.membershipDao.findMembersByCourse(courseId, roleFilter);

      return Ok(
        res,
        'Course members retrieved successfully',
        members.map((m) => sanitizeMembership(m.toObject()))
      );
    } catch (error) {
      next(error);
    }
  };

  // assign a role to a user in a course (ARBAC: course admin only)
  assignMember = async (req: CourseScopedRequest, res: Response, next: NextFunction) => {
    try {
      const courseId = getParam(req.params.courseId, req.courseId);
      const actorRole = req.courseMembership!.role;
      const { userId: targetUserId, role: targetRole } = req.body;

      // ARBAC check
      if (!checkArbacCanAssign(actorRole, targetRole as CourseRole)) {
        throw new Forbidden(
          `ARBAC Error: Role '${actorRole}' is not authorized to assign role '${targetRole}' in course '${courseId}'.`
        );
      }

      const assigned = await this.membershipDao.assignMembership({
        courseId,
        userId: targetUserId,
        role: targetRole as CourseRole,
        assignedBy: req.user!.userId,
        status: 'active'
      });

      return Created(
        res,
        'Member assigned to course successfully',
        sanitizeMembership(assigned.toObject())
      );
    } catch (error) {
      next(error);
    }
  };

  // update a member's role in a course (ARBAC: course admin only)
  updateMemberRole = async (req: CourseScopedRequest, res: Response, next: NextFunction) => {
    try {
      const courseId = getParam(req.params.courseId, req.courseId);
      const actorRole = req.courseMembership!.role;
      const targetUserId = getParam(req.params.userId);
      const { role: newRole } = req.body;

      // check if target exists
      const existing = await this.membershipDao.findMembership(courseId, targetUserId);
      if (!existing) {
        throw new NotFound(`Member '${targetUserId}' not found in course '${courseId}'.`);
      }

      // ARBAC check
      if (!checkArbacCanAssign(actorRole, newRole as CourseRole)) {
        throw new Forbidden(
          `ARBAC Error: Role '${actorRole}' is not authorized to grant role '${newRole}' in course '${courseId}'.`
        );
      }

      // Safeguard: do not demote last admin
      if (existing.role === COURSE_ROLES.ADMIN && newRole !== COURSE_ROLES.ADMIN) {
        const adminCount = await this.membershipDao.countAdminsInCourse(courseId);
        if (adminCount <= 1) {
          throw new BadRequest(
            `Cannot change role: user '${targetUserId}' is the sole admin of course '${courseId}'. Assign another admin first.`
          );
        }
      }

      const updated = await this.membershipDao.updateMembership(courseId, targetUserId, {
        role: newRole as CourseRole
      });

      return Ok(res, 'Member role updated successfully', sanitizeMembership(updated!.toObject()));
    } catch (error) {
      next(error);
    }
  };

  // revoke/remove a member from a course (ARBAC: course admin only)
  revokeMember = async (req: CourseScopedRequest, res: Response, next: NextFunction) => {
    try {
      const courseId = getParam(req.params.courseId, req.courseId);
      const actorRole = req.courseMembership!.role;
      const targetUserId = getParam(req.params.userId);

      const existing = await this.membershipDao.findMembership(courseId, targetUserId);
      if (!existing) {
        throw new NotFound(`Member '${targetUserId}' not found in course '${courseId}'.`);
      }

      // ARBAC check
      if (!checkArbacCanRevoke(actorRole, existing.role as CourseRole)) {
        throw new Forbidden(
          `ARBAC Error: Role '${actorRole}' is not authorized to revoke role '${existing.role}' in course '${courseId}'.`
        );
      }

      // Safeguard: do not delete the sole admin
      if (existing.role === COURSE_ROLES.ADMIN) {
        const adminCount = await this.membershipDao.countAdminsInCourse(courseId);
        if (adminCount <= 1) {
          throw new BadRequest(
            `Cannot revoke membership: user '${targetUserId}' is the sole admin of course '${courseId}'.`
          );
        }
      }

      await this.membershipDao.removeMembership(courseId, targetUserId);

      return Ok(res, `Member '${targetUserId}' successfully removed from course '${courseId}'.`, {
        courseId,
        userId: targetUserId,
        revokedBy: req.user!.userId
      });
    } catch (error) {
      next(error);
    }
  };
}

export default MembershipController;
