// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';
import Forbidden from '../errors/Forbidden.error.js';
import Unauthorized from '../errors/Unauthorized.error.js';

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
      const serviceUrl = process.env.USER_SERVICE_URL;
      const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;
      if (serviceUrl && serviceToken) {
        try {
          const response = await fetch(`${serviceUrl}/api/rbac/verify-any`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-internal-service-token': serviceToken
            },
            body: JSON.stringify({ userId: req.user.userId, allowedRoles }),
            signal: AbortSignal.timeout(3000)
          });
          const payload = (await response.json()) as { data?: { authorized?: boolean } };
          if (response.ok && payload.data?.authorized) return next();
        } catch {
          /* fail closed */
        }
      }
      throw new Forbidden(`Action requires one of [${allowedRoles.join(', ')}] role.`);
    }

    next();
  };
}

export default requireRole;
