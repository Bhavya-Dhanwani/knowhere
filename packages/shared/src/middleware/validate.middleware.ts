import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/AppError.js';

interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemaOrTargets: ZodSchema | ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if ('parse' in schemaOrTargets && typeof schemaOrTargets.parse === 'function') {
        req.body = schemaOrTargets.parse(req.body);
        return next();
      }

      const targets = schemaOrTargets as ValidationTargets;
      if (targets.body) {
        req.body = targets.body.parse(req.body);
      }
      if (targets.params) {
        const parsed = targets.params.parse(req.params);
        Object.assign(req.params, parsed);
      }
      if (targets.query) {
        const parsed = targets.query.parse(req.query);
        Object.assign(req.query, parsed);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        throw new ValidationError('Validation failed', details);
      }
      throw new ValidationError('Validation failed');
    }
  };
}
