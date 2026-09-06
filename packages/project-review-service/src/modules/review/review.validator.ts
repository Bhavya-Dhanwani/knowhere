import { body, param } from 'express-validator';

export const createEventValidators = [
  body('name').isString().notEmpty().withMessage('Event name is required'),
  body('description').isString().notEmpty().withMessage('Event description is required'),
  body('problemStatement').isString().notEmpty().withMessage('Problem statement is required'),
  body('criteria').isArray({ min: 1 }).withMessage('At least one criterion is required'),
  body('criteria.*.id').isString().notEmpty(),
  body('criteria.*.name').isString().notEmpty(),
  body('criteria.*.weight')
    .isFloat({ min: 0, max: 1 })
    .withMessage('Weight must be between 0 and 1'),
  body('criteria.*.category')
    .isIn(['CODE_QUALITY', 'SECURITY', 'FRONTEND', 'BACKEND_API', 'REQUIREMENTS', 'INNOVATION'])
    .withMessage('Invalid criterion category'),
  body('requirements').optional().isArray(),
  body('projectType')
    .optional()
    .isIn(['FRONTEND', 'BACKEND', 'FULLSTACK', 'CUSTOM'])
    .withMessage('Invalid project type'),
  body('requiresLiveUrl').optional().isBoolean(),
  body('requiresApiSpec').optional().isBoolean()
];

export const updateEventValidators = [
  param('id').isMongoId().withMessage('Valid event ID required'),
  body('name').optional().isString().notEmpty().withMessage('Event name cannot be empty'),
  body('description').optional().isString().notEmpty(),
  body('problemStatement').optional().isString().notEmpty(),
  body('criteria').optional().isArray({ min: 1 }),
  body('requirements').optional().isArray(),
  body('projectType').optional().isIn(['FRONTEND', 'BACKEND', 'FULLSTACK', 'CUSTOM']),
  body('requiresLiveUrl').optional().isBoolean(),
  body('requiresApiSpec').optional().isBoolean(),
  body('status').optional().isIn(['DRAFT', 'ACTIVE', 'EVALUATION', 'COMPLETED'])
];

export const createSubmissionValidators = [
  param('id').isMongoId().withMessage('Valid event ID required'),
  body('teamName').isString().notEmpty().withMessage('Team name is required'),
  body('teamId').isString().notEmpty().withMessage('Team ID is required'),
  body('repositoryUrl').isString().notEmpty().withMessage('Repository URL is required'),
  body('branch').optional({ checkFalsy: true }).isString(),
  body('liveSiteUrl')
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage('Live site must be a valid URL'),
  body('apiSpecUrl').optional({ checkFalsy: true }).isString(),
  body('rawReadmeText').optional({ checkFalsy: true }).isString()
];

export const updateSubmissionValidators = [
  param('id').isMongoId().withMessage('Valid submission ID required'),
  body('teamName').optional().isString().notEmpty(),
  body('teamId').optional().isString().notEmpty(),
  body('repositoryUrl').optional().isString().notEmpty(),
  body('branch').optional({ checkFalsy: true }).isString(),
  body('liveSiteUrl')
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage('Live site must be a valid URL'),
  body('apiSpecUrl').optional({ checkFalsy: true }).isString(),
  body('rawReadmeText').optional({ checkFalsy: true }).isString()
];

export const submissionIdValidators = [
  param('id').isMongoId().withMessage('Valid submission ID required')
];

export const eventIdValidators = [param('id').isMongoId().withMessage('Valid event ID required')];

export const judgeOverrideValidators = [
  param('id').isMongoId().withMessage('Valid submission ID required'),
  body('newScore').isFloat({ min: 0, max: 100 }).withMessage('Score must be between 0 and 100'),
  body('reason')
    .isString()
    .isLength({ min: 10 })
    .withMessage('Override reason must be at least 10 characters')
];
