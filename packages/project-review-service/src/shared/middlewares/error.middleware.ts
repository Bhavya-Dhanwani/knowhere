import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.config.js';

function errorHandler(
  err: Error & { statusCode?: number; data?: unknown },
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error(err);

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: err.message || 'Internal Server Error',
    data: err.data || null
  });
}

export default errorHandler;
