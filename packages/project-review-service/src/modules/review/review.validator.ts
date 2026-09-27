import { body, param } from 'express-validator';
import type { IFormField } from '../../models/Event.model.js';
import { BadRequest } from '../../shared/errors/index.js';

/** Checks a submission's answers against the event's custom form; returns only known, trimmed answers. */
export const checkFormResponses = (
  fields: Pick<IFormField, 'id' | 'label' | 'type' | 'required' | 'options'>[],
  raw: unknown
): Record<string, string> => {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const answers: Record<string, string> = {};
  for (const f of fields) {
    const value = String(input[f.id] ?? '').trim();
    if (!value) {
      if (f.required) throw new BadRequest(`"${f.label}" is required`);
      continue;
    }
    if (value.length > 5000) throw new BadRequest(`"${f.label}" is too long (max 5000 characters)`);
    if (f.type === 'url' && !/^https?:\/\/\S+$/i.test(value))
      throw new BadRequest(`"${f.label}" must be a valid http(s) URL`);
    if (f.type === 'number' && !Number.isFinite(Number(value)))
      throw new BadRequest(`"${f.label}" must be a number`);
    if (f.type === 'select' && !f.options?.includes(value))
      throw new BadRequest(`"${f.label}" must be one of: ${(f.options || []).join(', ')}`);
    answers[f.id] = value;
  }
  return answers;
};

// custom submission-form fields an organiser attaches to an event
const formFieldValidators = [
  body('formFields').optional().isArray({ max: 30 }),
  body('formFields.*.id').isString().notEmpty(),
  body('formFields.*.label').isString().notEmpty().withMessage('Form field label is required'),
  body('formFields.*.type').isIn(['text', 'textarea', 'url', 'number', 'select']),
  body('formFields.*.required').optional().isBoolean(),
  body('formFields.*.options').optional().isArray(),
  body('judgingPromptPublic').optional().isBoolean(),
  body('resultsPublished').optional().isBoolean(),
  body('ioTests').optional().isArray({ max: 200 }),
  body('ioTests.*.input').optional().isString().isLength({ max: 100_000 }),
  body('ioTests.*.expected').isString().isLength({ max: 100_000 }),
  body('ioTests.*.name').optional().isString().isLength({ max: 200 }),
  body('runCommand').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  body('judgingPrompt')
    .optional()
    .isString()
    .isLength({ max: 4000 })
    .withMessage('Judging instructions can be at most 4000 characters'),
  body('submissionDeadline')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('Invalid deadline')
];

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
  body('requiresApiSpec').optional().isBoolean(),
  ...formFieldValidators
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
  ...formFieldValidators,
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
  body('rawReadmeText').optional({ checkFalsy: true }).isString(),
  body('formResponses').optional().isObject()
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
  body('rawReadmeText').optional({ checkFalsy: true }).isString(),
  body('formResponses').optional().isObject()
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
