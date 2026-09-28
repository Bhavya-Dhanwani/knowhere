// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import UserProfileDao from '../../shared/dao/userProfile.dao.js';
import CourseMembershipDao from '../../shared/dao/courseMembership.dao.js';
import sanitizeUserProfile, {
  publicProfile
} from '../../shared/sanitizers/userProfile.sanitizer.js';
import Conflict from '../../shared/errors/Conflict.error.js';
import { slugify, uniqueUsername, usernameError } from '../../shared/utils/username.util.js';
import { verifyAccessToken } from '@lms/shared';
import { Request } from 'express';

// every editable profile field (email comes from auth, role from the access token)
const EDITABLE = [
  'name',
  'avatar',
  'bio',
  'phone',
  'username',
  'visibility',
  'headline',
  'location',
  'links',
  'skills',
  'interests',
  'qualifications',
  'experience',
  'certificates'
] as const;
const uniq = (xs: unknown) =>
  Array.isArray(xs) ? [...new Set(xs.map((x) => String(x).trim()).filter(Boolean))] : xs;
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
      // every profile gets a shareable username, and mirrors the platform role from the token
      const patch: Record<string, unknown> = {};
      if (!profile!.get('username')) {
        patch.username = await uniqueUsername(
          slugify(String(profile!.get('name') || ''), String(profile!.get('email') || '')),
          (u) => this.profileDao.usernameTaken(u, userId)
        );
      }
      if (req.user?.role && profile!.get('role') !== req.user.role) patch.role = req.user.role;
      if (Object.keys(patch).length) profile = await this.profileDao.upsertProfile(userId, patch);

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
      const update: Record<string, unknown> = {};
      for (const k of EDITABLE) if (req.body[k] !== undefined) update[k] = req.body[k];
      if (!update.name) delete update.name;
      if (update.skills) update.skills = uniq(update.skills);
      if (update.interests) update.interests = uniq(update.interests);
      if (
        update.username &&
        (await this.profileDao.usernameTaken(String(update.username), userId))
      ) {
        throw new Conflict('That username is taken.');
      }

      let updated;
      try {
        updated = await this.profileDao.upsertProfile(userId, update);
      } catch (error) {
        // two people claiming the same username at the same moment: the unique index decides
        if ((error as { code?: number }).code === 11000)
          throw new Conflict('That username is taken.');
        throw error;
      }

      return Ok(res, 'Profile updated successfully', sanitizeUserProfile(updated!.toObject()));
    } catch (error) {
      next(error);
    }
  };

  // GET /api/profile/username-available?u=name — for the profile editor
  usernameAvailable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const u = String(req.query.u || '')
        .trim()
        .toLowerCase();
      const reason =
        usernameError(u) ||
        ((await this.profileDao.usernameTaken(u, req.user!.userId))
          ? 'That username is taken.'
          : null);
      return Ok(res, 'Checked', { username: u, available: !reason, reason });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/profiles/u/:username — the shareable page (domain.com/<username>). Public profiles are
  // open to anyone; "members" ones need a signed-in viewer; private ones exist only for the owner.
  publicByUsername = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = String(req.params.username || '').toLowerCase();
      const profile = username ? await this.profileDao.findProfileByUsername(username) : null;
      // the viewer is optional here, so the token is checked by hand
      let viewerId: string | null = null;
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        try {
          viewerId = (verifyAccessToken(auth.slice(7)) as { userId?: string }).userId || null;
        } catch {
          viewerId = null;
        }
      }
      const p = profile?.toObject() as Record<string, unknown> | undefined;
      const owner = Boolean(p && viewerId && p.userId === viewerId);
      const visibility = (p?.visibility as string) || 'public';
      // private (or unknown) looks exactly like "no such user"
      if (!p || (visibility === 'private' && !owner)) {
        throw new NotFound('No profile with that username.');
      }
      if (visibility === 'members' && !viewerId) {
        return res.status(401).json({
          success: false,
          status: 401,
          message: 'Sign in to see this profile.'
        });
      }
      const memberships = await this.membershipDao.findCoursesByUser(String(p.userId), 'active');
      return Ok(res, 'Profile', {
        ...publicProfile(p),
        isOwner: owner,
        stats: {
          learning: memberships.filter((m) => m.role === 'trainee').length,
          teaching: memberships.filter((m) => m.role !== 'trainee').length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // bulk public profiles: GET /profiles?ids=a,b,c (max 200)
  listProfiles = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ids = String(req.query.ids || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 200);
      const profiles = ids.length ? await this.profileDao.findProfilesByUserIds(ids) : [];
      return Ok(
        res,
        'Profiles retrieved successfully',
        profiles.map((p) => sanitizeUserProfile(p.toObject()))
      );
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
