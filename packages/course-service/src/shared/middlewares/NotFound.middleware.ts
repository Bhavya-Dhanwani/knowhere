// Importing modules
import { Request, Response, NextFunction } from 'express';
import NotFound from '../errors/NotFound.error.js';

// function to handle not found errors in the application
function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  throw new NotFound('Resource not found');
}

export default notFoundHandler;
