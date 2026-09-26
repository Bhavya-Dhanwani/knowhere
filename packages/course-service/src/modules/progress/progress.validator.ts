import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';
import { JUDGE_LANGUAGES } from '@lms/shared';

export const completeItemValidators = [
  param('courseId').isMongoId().withMessage('Invalid course ID format'),
  param('itemId').isMongoId().withMessage('Invalid content item ID format'),
  body('code')
    .optional()
    .isString()
    .isLength({ max: 100_000 })
    .withMessage('code must be a string of at most 100KB'),
  body('language').optional().isIn(JUDGE_LANGUAGES).withMessage('Unsupported language'),
  validateErrors
];

export const getProgressValidators = [
  param('courseId').isMongoId().withMessage('Invalid course ID format'),
  validateErrors
];
