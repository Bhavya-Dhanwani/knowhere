import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js';

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('User unauthenticated.');
    }

    const userRole = req.user.role || 'trainee';
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenError(
        `Forbidden: Action requires one of [${allowedRoles.join(', ')}] role, but got '${userRole}'.`
      );
    }

    next();
  };
}
