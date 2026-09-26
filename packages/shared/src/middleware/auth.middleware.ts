import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { UnauthorizedError } from '../errors/AppError.js';
import { verifyAccessToken } from '../utils/keys.js';
import { ServiceScope, verifyServiceToken } from '../utils/courseMembership.js';

const bearer = (req: AuthenticatedRequest) => {
  const header = req.headers?.authorization;
  return header?.startsWith('Bearer ') ? header.split(' ')[1] : header;
};

// Verifies the RS256 access token issued by auth-service and attaches the user.
export function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = bearer(req);
  if (!token) throw new UnauthorizedError('User unauthenticated: Missing token.');

  let decoded: Record<string, unknown>;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError('Access token is invalid or expired.');
  }
  const userId = (decoded.userId || decoded._id || decoded.id || decoded.sub) as string;
  if (!userId) throw new UnauthorizedError('Invalid token payload: missing userId.');

  req.user = {
    userId: userId.toString(),
    email: decoded.email as string | undefined,
    role: (decoded.role as string) || 'trainee',
    name: decoded.name as string | undefined,
    isVerified: decoded.isVerified as boolean | undefined
  };
  next();
}

// For routes other services call: a service token with `scope` acts as a platform admin for
// this request only; anything else goes through the normal user check.
export function serviceOrUserAuth(scope: ServiceScope) {
  return function serviceOrUserAuthMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    const token = bearer(req);
    const caller = token ? verifyServiceToken(token, scope) : null;
    if (!caller) return authMiddleware(req, res, next);
    req.user = { userId: `service:${caller.service}`, role: 'admin', name: caller.service };
    next();
  };
}
