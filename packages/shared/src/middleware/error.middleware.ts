import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { sendError } from '../utils/response.util.js';

export function errorHandler(
  err: Error | AppError | any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    sendError(
      res,
      {
        code: err.code,
        message: err.message,
        details: err.details
      },
      err.statusCode
    );
    return;
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    sendError(
      res,
      {
        code: 'INVALID_ID',
        message: `Invalid identifier: ${err.value}`
      },
      400
    );
    return;
  }

  // Handle Mongo duplicate key error (code 11000)
  if (err.code === 11000) {
    sendError(
      res,
      {
        code: 'CONFLICT',
        message: 'A duplicate record already exists.',
        details: err.keyValue
      },
      409
    );
    return;
  }

  // Fallback for generic errors
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  sendError(
    res,
    {
      code: 'INTERNAL_ERROR',
      message
    },
    statusCode
  );
}
