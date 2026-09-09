import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthUser } from '../types/index.js';
import { UnauthorizedError } from '../errors/AppError.js';

export function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  if (!token) {
    throw new UnauthorizedError('User unauthenticated: Missing token.');
  }

  try {
    const secret =
      process.env.ACCESS_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      process.env.JWT_PUBLIC_KEY ||
      (process.env.NODE_ENV === 'test' ? 'test_only_access_secret_at_least_32_chars' : '');
    if (!secret) throw new UnauthorizedError('Authentication is not configured.');
    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    if (decoded.isVerified === false) {
      throw new UnauthorizedError('Email verification is required.');
    }

    const userId = (decoded.userId || decoded._id || decoded.id || decoded.sub) as string;
    if (!userId) {
      throw new UnauthorizedError('Invalid token payload: missing userId.');
    }

    req.user = {
      userId: userId.toString(),
      email: decoded.email as string | undefined,
      role: (decoded.role as string) || 'trainee',
      name: decoded.name as string | undefined,
      isVerified: decoded.isVerified as boolean | undefined
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Access token is invalid or expired.');
  }
}
