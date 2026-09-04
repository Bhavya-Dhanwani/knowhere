// Importing modules
import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const createModuleValidators = [
  body('courseId').isMongoId().withMessage('Valid courseId is required'),

  body('title').notEmpty().withMessage('Module title is required').trim(),

  body('order').optional().isInt({ min: 1 }).withMessage('Order must be a positive integer'),

  body('description').optional().isString(),

  validateErrors
];

export const updateModuleValidators = [
  param('id').isMongoId().withMessage('Invalid module ID format'),

  body('title').optional().notEmpty().withMessage('Module title cannot be empty').trim(),

  body('order').optional().isInt({ min: 1 }).withMessage('Order must be a positive integer'),

  validateErrors
];
