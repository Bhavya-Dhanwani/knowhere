// Importing modules
import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';
import { VALID_COURSE_ROLES } from '../../shared/constants/roles.constants.js';

export const assignMemberValidators = [
  param('courseId').notEmpty().withMessage('Course ID parameter is required'),

  body('userId').notEmpty().withMessage('User ID is required').isString().trim(),

  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(VALID_COURSE_ROLES)
    .withMessage(`Role must be one of: ${VALID_COURSE_ROLES.join(', ')}`),

  validateErrors
];

export const updateRoleValidators = [
  param('courseId').notEmpty().withMessage('Course ID parameter is required'),

  param('userId').notEmpty().withMessage('User ID parameter is required'),

  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(VALID_COURSE_ROLES)
    .withMessage(`Role must be one of: ${VALID_COURSE_ROLES.join(', ')}`),

  validateErrors
];
