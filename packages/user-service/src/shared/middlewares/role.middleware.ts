// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';
import Forbidden from '../errors/Forbidden.error.js';
import Unauthorized from '../errors/Unauthorized.error.js';
import CourseMembershipDao from '../dao/courseMembership.dao.js';

// function to require one of the specified roles
export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // if user is not authenticated, throw unauthorized error
    if (!req.user) {
      throw new Unauthorized('User unauthenticated.');
    }

    const userRole = req.user.role || 'trainee';

    // if user role is not in allowed roles, throw forbidden error
    if (!allowedRoles.includes(userRole)) {
      if (process.env.NODE_ENV !== 'test') {
        const membership = await new CourseMembershipDao().findAnyActiveMembership(
          req.user.userId,
          allowedRoles
        );
        if (membership) return next();
      }
      throw new Forbidden(`Action requires one of [${allowedRoles.join(', ')}] role.`);
    }

    next();
  };
}

export default requireRole;
