import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const getContentItemDetailValidators = [
  param('id').isMongoId().withMessage('Invalid content item ID format'),
  validateErrors
];

export const updateContentItemValidators = [
  param('id').isMongoId().withMessage('Invalid content item ID format'),
  body('title').optional().isString().trim().notEmpty().withMessage('Title cannot be empty'),
  body('max_score')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('max_score must be a non-negative number'),
  body('order').optional().isInt({ min: 1 }).withMessage('Order must be a positive integer'),
  validateErrors
];
