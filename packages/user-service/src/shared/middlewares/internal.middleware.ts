import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import env from '../config/env.config.js';
import Unauthorized from '../errors/Unauthorized.error.js';

export default function requireInternalService(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const supplied = req.header('x-internal-service-token') || '';
  const expected = env.INTERNAL_SERVICE_TOKEN;
  const valid =
    supplied.length === expected.length &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) throw new Unauthorized('Valid internal service credentials are required.');
  next();
}
