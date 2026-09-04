import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const completeItemValidators = [
  param('courseId').isMongoId().withMessage('Invalid course ID format'),
  param('itemId').isMongoId().withMessage('Invalid content item ID format'),
  body('scoreEarned')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('scoreEarned must be a non-negative number'),
  validateErrors
];

export const getProgressValidators = [
  param('courseId').isMongoId().withMessage('Invalid course ID format'),
  validateErrors
];
