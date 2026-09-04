// Importing modules
import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const createSubmoduleValidators = [
  body('moduleId').isMongoId().withMessage('Valid moduleId is required'),

  body('title').notEmpty().withMessage('Submodule title is required').trim(),

  body('order').optional().isInt({ min: 1 }).withMessage('Order must be a positive integer'),

  validateErrors
];

export const updateSubmoduleValidators = [
  param('id').isMongoId().withMessage('Invalid submodule ID format'),

  body('title').optional().notEmpty().withMessage('Submodule title cannot be empty').trim(),

  body('order').optional().isInt({ min: 1 }).withMessage('Order must be a positive integer'),

  validateErrors
];

export const attachContentItemValidators = [
  param('id').isMongoId().withMessage('Invalid submodule ID format'),

  body('type')
    .notEmpty()
    .withMessage('ContentItem type is required')
    .isIn(['video', 'notes', 'mcq', 'coding'])
    .withMessage('Type must be one of: video, notes, mcq, coding'),

  body('ref_id')
    .notEmpty()
    .withMessage('ref_id is required')
    .isMongoId()
    .withMessage('ref_id must be a valid MongoDB ObjectId'),

  body('order').optional().isInt({ min: 1 }).withMessage('Order must be a positive integer'),

  body('max_score')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('max_score must be a non-negative number'),

  validateErrors
];

export const listContentItemsValidators = [
  param('id').isMongoId().withMessage('Invalid submodule ID format'),
  validateErrors
];
