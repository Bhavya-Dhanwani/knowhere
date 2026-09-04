// Importing modules
import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const createCompetencyValidators = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isString()
    .withMessage('User ID must be a string'),

  body('skill')
    .notEmpty()
    .withMessage('Skill is required')
    .isString()
    .withMessage('Skill must be a string'),

  body('level')
    .notEmpty()
    .withMessage('Level is required')
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Level must be one of: beginner, intermediate, advanced'),

  body('score')
    .optional()
    .isNumeric()
    .withMessage('Score must be a number')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),

  body('verifiedBy').optional().isString().withMessage('VerifiedBy must be a string'),

  validateErrors
];

export const getCompetenciesValidators = [
  param('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isString()
    .withMessage('User ID must be a string'),

  validateErrors
];
