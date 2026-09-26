import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import env from '../config/env.config.js';
import { Unauthorized } from '../errors/index.js';
import { verifyAccessToken } from '@lms/shared';

export interface AuthUser {
  _id?: string;
  userId: string;
  name?: string;
  email?: string;
  role?: string;
  isVerified?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers?.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  if (!accessToken) {
    throw new Unauthorized('User unauthenticated.');
  }

  try {
    const decoded = verifyAccessToken(accessToken);
    const userId = (decoded.userId || decoded._id || decoded.id) as string;

    if (!userId) {
      throw new Unauthorized('Invalid token payload: missing userId.');
    }

    req.user = {
      _id: decoded._id as string | undefined,
      userId: userId.toString(),
      name: decoded.name as string | undefined,
      email: decoded.email as string | undefined,
      role: (decoded.role as string) || 'trainee',
      isVerified: decoded.isVerified as boolean | undefined
    };

    next();
  } catch {
    throw new Unauthorized('Access token expired or invalid.');
  }
}

export default authMiddleware;
