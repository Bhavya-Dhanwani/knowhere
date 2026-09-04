import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const createQuestionValidators = [
  body('title').isString().trim().notEmpty().withMessage('Question title is required'),
  body('stem').isString().trim().notEmpty().withMessage('Question stem is required'),
  body('options').isArray({ min: 2 }).withMessage('At least 2 options are required'),
  body('options.*.id').isString().notEmpty().withMessage('Option id is required'),
  body('options.*.text').isString().trim().notEmpty().withMessage('Option text is required'),
  body('correct_option_id').isString().notEmpty().withMessage('correct_option_id is required'),
  body('max_score').optional().isInt({ min: 1 }).withMessage('max_score must be at least 1'),
  body('explanation').optional().isString().trim(),
  validateErrors
];

export const getQuestionDisplayValidators = [
  param('id').isMongoId().withMessage('Invalid question ID format'),
  validateErrors
];

export const submitAttemptValidators = [
  param('id').isMongoId().withMessage('Invalid question ID format'),
  body('selected_option_id').isString().notEmpty().withMessage('selected_option_id is required'),
  validateErrors
];
