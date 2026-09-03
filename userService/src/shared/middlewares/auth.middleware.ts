// Importing modules
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import env from '../config/env.config.js';
import Unauthorized from '../errors/Unauthorized.error.js';

export interface AuthUser {
  _id?: string;
  userId: string;
  name?: string;
  email?: string;
  isVerified?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// Function to check if the user is authenticated via JWT from authService
function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // getting the access token from the request headers
  const authHeader = req.headers?.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  // if the access token is not present, return an error
  if (!accessToken) {
    throw new Unauthorized('User unauthenticated.');
  }

  try {
    // verifying the access token using shared secret
    const decoded = jwt.verify(accessToken, env.ACCESS_TOKEN_SECRET) as Record<string, unknown>;

    const userId = (decoded.userId || decoded._id || decoded.id) as string;
    if (!userId) {
      throw new Unauthorized('Invalid token payload: missing userId.');
    }

    // attach decoded user to the request object
    req.user = {
      _id: decoded._id as string | undefined,
      userId: userId.toString(),
      name: decoded.name as string | undefined,
      email: decoded.email as string | undefined,
      isVerified: decoded.isVerified as boolean | undefined
    };

    next();
  } catch (error) {
    throw new Unauthorized('Access token expired or invalid.');
  }
}

export default authMiddleware;
