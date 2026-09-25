import { body, param } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';

export const uploadResourceValidators = [
  body('fileName').notEmpty().withMessage('fileName is required').trim(),
  body('mimeType').notEmpty().withMessage('mimeType is required').trim(),
  body('fileSize')
    .notEmpty()
    .withMessage('fileSize is required')
    .isNumeric()
    .withMessage('fileSize must be a number')
    .custom((val) => Number(val) > 0)
    .withMessage('fileSize must be greater than 0'),
  body('resourceType')
    .notEmpty()
    .withMessage('resourceType is required')
    .isIn(['video', 'pdf', 'docx', 'xlsx', 'image', 'resource'])
    .withMessage('Invalid resourceType'),
  body('courseId').notEmpty().withMessage('courseId is required').trim(),
  body('submoduleId').optional({ values: 'null' }).isString(),
  validateErrors
];

export const createMcqValidators = [
  body('question').notEmpty().withMessage('question is required').trim(),
  body('options')
    .isArray({ min: 4, max: 4 })
    .withMessage('options must be an array of exactly 4 items'),
  body('options.*.text').notEmpty().withMessage('Option text is required').trim(),
  body('correctOptionIndex')
    .notEmpty()
    .withMessage('correctOptionIndex is required')
    .isInt({ min: 0, max: 3 })
    .withMessage('correctOptionIndex must be an integer between 0 and 3'),
  body('explanation').notEmpty().withMessage('explanation is required').trim(),
  body('questionResourceIds')
    .optional()
    .isArray()
    .withMessage('questionResourceIds must be an array'),
  body('explanationResourceIds')
    .optional()
    .isArray()
    .withMessage('explanationResourceIds must be an array'),
  body('tags').optional().isArray().withMessage('tags must be an array'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('difficulty must be easy, medium, or hard'),
  validateErrors
];

export const createCodeQuestionValidators = [
  body('title').notEmpty().withMessage('title is required').trim(),
  body('description').notEmpty().withMessage('description is required').trim(),
  body('constraints').isArray().withMessage('constraints must be an array'),
  body('inputFormat').notEmpty().withMessage('inputFormat is required').trim(),
  body('outputFormat').notEmpty().withMessage('outputFormat is required').trim(),
  body('examples')
    .optional()
    .isArray({ max: 5 })
    .withMessage('examples must be an array with at most 5 items'),
  body('supportedLanguages')
    .isArray({ min: 1 })
    .withMessage('supportedLanguages must be an array with at least one language'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('difficulty must be easy, medium, or hard'),
  validateErrors
];

export const createSubmoduleValidators = [
  body('title').notEmpty().withMessage('title is required').trim(),
  body('courseId').notEmpty().withMessage('courseId is required').trim(),
  body('description').optional().isString(),
  body('content').optional().isArray().withMessage('content must be an array'),
  validateErrors
];

export const createModuleValidators = [
  body('title').notEmpty().withMessage('title is required').trim(),
  body('durationDays')
    .notEmpty()
    .withMessage('durationDays is required')
    .isInt({ min: 1 })
    .withMessage('durationDays must be a positive integer representing relative days'),
  body('submoduleIds').optional().isArray().withMessage('submoduleIds must be an array'),
  body('progressRequirement')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('progressRequirement must be between 0 and 100'),
  validateErrors
];

export const createCourseValidators = [
  body('title').notEmpty().withMessage('title is required').trim(),
  body('description').optional().isString(),
  body('modules').optional().isArray().withMessage('modules must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('status must be draft, published, or archived'),
  validateErrors
];

export const addModuleValidators = [
  body('courseId').notEmpty().withMessage('courseId is required').trim(),
  body('moduleId').notEmpty().withMessage('moduleId is required').trim(),
  body('order').notEmpty().withMessage('order is required').isInt({ min: 1 }),
  validateErrors
];

export const checkMcqValidators = [
  body('mcqId').notEmpty().withMessage('mcqId is required').trim(),
  body('selectedOptionId').notEmpty().withMessage('selectedOptionId is required').trim(),
  validateErrors
];

export const idParamValidators = [
  param('id').notEmpty().withMessage('Resource ID is required').trim(),
  validateErrors
];
