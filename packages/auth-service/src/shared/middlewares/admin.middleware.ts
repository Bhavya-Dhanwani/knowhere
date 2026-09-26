// Importing modules
import { Request, Response, NextFunction } from 'express';
import Forbidden from '../errors/Forbidden.error.js';

// Function to allow only platform admins (must run after authMiddleware)
function adminMiddleware(
  req: Request & { user?: Record<string, unknown> },
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== 'admin') {
    throw new Forbidden('Admin access required.');
  }

  next();
}

export default adminMiddleware;
