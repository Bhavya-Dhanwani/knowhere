// Importing modules
import { body } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const verifyRbacValidators = [
  body('userId').notEmpty().withMessage('userId is required').isString(),

  body('courseId').notEmpty().withMessage('courseId is required').isString(),

  body('allowedRoles')
    .isArray({ min: 1 })
    .withMessage('allowedRoles must be a non-empty array of roles'),

  validateErrors
];

export const initialAdminValidators = [
  body('userId').notEmpty().withMessage('userId is required').isString(),

  body('courseId').notEmpty().withMessage('courseId is required').isString(),

  validateErrors
];
