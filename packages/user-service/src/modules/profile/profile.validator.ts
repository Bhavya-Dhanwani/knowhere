// Importing modules
import { body } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const updateProfileValidators = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),

  body('avatar')
    .optional()
    .isString()
    .trim()
    .withMessage('Avatar must be a valid string URL or path'),

  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  body('phone').optional().isString().trim().withMessage('Phone must be a valid string'),

  validateErrors
];
