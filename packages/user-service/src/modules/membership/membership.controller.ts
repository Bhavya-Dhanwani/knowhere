// Importing modules
import { Response, NextFunction } from 'express';
import {
  CourseScopedRequest,
  checkArbacCanAssign,
  checkArbacCanRevoke
} from '../../shared/middlewares/arbac.middleware.js';
import CourseMembershipDao from '../../shared/dao/courseMembership.dao.js';
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

      const existing = await this.membershipDao.findMembership(courseId, targetUserId);
      if (existing?.role === COURSE_ROLES.ADMIN && targetRole !== COURSE_ROLES.ADMIN) {
        const adminCount = await this.membershipDao.countAdminsInCourse(courseId);
        if (adminCount <= 1) {
          throw new BadRequest('Cannot demote the sole course administrator.');
        }
      }

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
