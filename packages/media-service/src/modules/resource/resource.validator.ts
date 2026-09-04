import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const getUploadUrlValidators = [
  body('title').isString().trim().notEmpty().withMessage('Title is required'),
  body('type').isIn(['video', 'notes']).withMessage('Type must be either video or notes'),
  body('contentType')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('ContentType (e.g. video/mp4, application/pdf) is required'),
  validateErrors
];

export const getResourceByIdValidators = [
  param('id').isMongoId().withMessage('Invalid resource ID format'),
  validateErrors
];

export const updateResourceStatusValidators = [
  param('id').isMongoId().withMessage('Invalid resource ID format'),
  body('status')
    .isIn(['pending', 'processing', 'ready', 'failed'])
    .withMessage('Status must be pending, processing, ready, or failed'),
  body('playbackUrl').optional().isString().trim(),
  body('durationSeconds').optional().isNumeric(),
  body('fileSizeBytes').optional().isNumeric(),
  validateErrors
];
