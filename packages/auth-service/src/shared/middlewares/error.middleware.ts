// Importing modules
import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.config.js';

// function to handle errors in the application
function errorHandler(
  err: Error & { statusCode?: number; status?: number },
  req: Request,
  res: Response,
  next: NextFunction
) {
  // logging the error
  logger.error(err);

  const statusCode = err.statusCode || err.status || (err.name === 'CastError' ? 400 : 500);

  // sending the error response with status code and message
  return res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: err.message || 'Internal Server Error'
  });
}

export default errorHandler;
