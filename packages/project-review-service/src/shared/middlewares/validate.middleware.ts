import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { BadRequest } from '../errors/index.js';

export function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((err) => ({
      field: 'path' in err ? err.path : undefined,
      message: err.msg
    }));
    const err = new BadRequest('Validation error');
    err.data = errorDetails;
    throw err;
  }
  next();
}

export default validate;
