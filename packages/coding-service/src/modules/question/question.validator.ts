import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const createQuestionValidators = [
  body('title').isString().trim().notEmpty().withMessage('Question title is required'),
  body('description').isString().trim().notEmpty().withMessage('Question description is required'),
  body('testCases').isArray({ min: 1 }).withMessage('At least one testcase is required'),
  body('testCases.*.input').isString().notEmpty().withMessage('TestCase input is required'),
  body('testCases.*.expectedOutput')
    .isString()
    .notEmpty()
    .withMessage('TestCase expectedOutput is required'),
  body('testCases.*.isHidden').optional().isBoolean(),
  body('max_score').optional().isInt({ min: 1 }).withMessage('max_score must be at least 1'),
  validateErrors
];

export const getQuestionDisplayValidators = [
  param('id').isMongoId().withMessage('Invalid question ID format'),
  validateErrors
];

export const submitCodeValidators = [
  param('id').isMongoId().withMessage('Invalid question ID format'),
  body('language').isString().trim().notEmpty().withMessage('Programming language is required'),
  body('code').isString().notEmpty().withMessage('Source code is required'),
  validateErrors
];

export const getSubmissionValidators = [
  param('id').isMongoId().withMessage('Invalid submission ID format'),
  validateErrors
];
