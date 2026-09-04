// Importing modules
import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const createCourseValidators = [
  body('title')
    .notEmpty()
    .withMessage('Course title is required')
    .isLength({ min: 3 })
    .withMessage('Course title must be at least 3 characters long'),

  body('description').optional().isString().withMessage('Description must be a string'),

  body('tags').optional().isArray().withMessage('Tags must be an array of strings'),

  validateErrors
];

export const updateCourseValidators = [
  param('id').isMongoId().withMessage('Invalid course ID format'),

  body('title')
    .optional()
    .isLength({ min: 3 })
    .withMessage('Course title must be at least 3 characters long'),

  body('description').optional().isString().withMessage('Description must be a string'),

  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be one of: draft, published, archived'),

  validateErrors
];
