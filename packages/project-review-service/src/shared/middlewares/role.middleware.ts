import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';
import { Forbidden, Unauthorized } from '../errors/index.js';

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new Unauthorized('User unauthenticated.');
    }

    const userRole = req.user.role || 'trainee';
    if (!allowedRoles.includes(userRole) && userRole !== 'admin') {
      throw new Forbidden(`Action requires one of [${allowedRoles.join(', ')}] roles.`);
    }

    next();
  };
}

export default requireRole;
