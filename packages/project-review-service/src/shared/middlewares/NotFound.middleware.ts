import { Request, Response, NextFunction } from 'express';
import { NotFound } from '../errors/index.js';

function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  throw new NotFound(`Resource not found: ${req.method} ${req.originalUrl}`);
}

export default notFoundHandler;
