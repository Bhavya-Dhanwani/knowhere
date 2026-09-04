// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import UserProfileDao from '../../shared/dao/userProfile.dao.js';
import CourseMembershipDao from '../../shared/dao/courseMembership.dao.js';
import sanitizeUserProfile from '../../shared/sanitizers/userProfile.sanitizer.js';
import sanitizeMembership from '../../shared/sanitizers/membership.sanitizer.js';
import Ok from '../../shared/responses/Ok.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';

// class to handle profile operations
class ProfileController {
  profileDao: UserProfileDao;
  membershipDao: CourseMembershipDao;

  constructor() {
    this.profileDao = new UserProfileDao();
    this.membershipDao = new CourseMembershipDao();
  }

  // get current authenticated user profile and course memberships
  me = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      // look up or create initial profile based on JWT info
      let profile = await this.profileDao.findProfileByUserId(userId);
      if (!profile) {
        profile = await this.profileDao.upsertProfile(userId, {
          name: req.user?.name || 'LMS User',
          email: req.user?.email || ''
        });
      }

      // get active course memberships for this user
      const memberships = await this.membershipDao.findCoursesByUser(userId, 'active');

      return Ok(res, 'User profile fetched successfully', {
        profile: sanitizeUserProfile(profile ? profile.toObject() : null),
        courses: memberships.map((m) => sanitizeMembership(m.toObject()))
      });
    } catch (error) {
      next(error);
    }
  };

  // update current user profile
  updateMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { name, avatar, bio, phone } = req.body;

      const updated = await this.profileDao.upsertProfile(userId, {
        ...(name && { name }),
        ...(avatar !== undefined && { avatar }),
        ...(bio !== undefined && { bio }),
        ...(phone !== undefined && { phone })
      });

      return Ok(res, 'Profile updated successfully', sanitizeUserProfile(updated.toObject()));
    } catch (error) {
      next(error);
    }
  };

  // get public profile by userId
  getProfileById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawUserId = req.params.userId;
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
      const profile = await this.profileDao.findProfileByUserId(userId);

      if (!profile) {
        throw new NotFound(`User profile for '${userId}' not found.`);
      }

      return Ok(res, 'Profile retrieved successfully', sanitizeUserProfile(profile.toObject()));
    } catch (error) {
      next(error);
    }
  };

  // update user profile by userId (self or admin only)
  updateProfileById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawUserId = req.params.userId;
      const targetUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
      const currentUserId = req.user!.userId;
      const currentUserRole = req.user!.role;

      // only allowed if req.user.userId === userId or req.user.role === 'admin'
      if (currentUserId !== targetUserId && currentUserRole !== 'admin') {
        throw new Forbidden('You do not have permission to update this profile.');
      }

      const { name, avatar, bio, phone } = req.body;

      const updated = await this.profileDao.upsertProfile(targetUserId, {
        ...(name && { name }),
        ...(avatar !== undefined && { avatar }),
        ...(bio !== undefined && { bio }),
        ...(phone !== undefined && { phone })
      });

      return Ok(res, 'Profile updated successfully', sanitizeUserProfile(updated.toObject()));
    } catch (error) {
      next(error);
    }
  };
}

export default ProfileController;
