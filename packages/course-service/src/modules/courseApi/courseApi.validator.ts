import { body, param } from 'express-validator';
import { JUDGE_LANGUAGES } from '@lms/shared';
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
  body('courseId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid courseId'),
  validateErrors
];

const mongoIdArray = (field: string) =>
  body(field).optional().isArray().withMessage(`${field} must be an array`).bail();

export const createMcqValidators = [
  body('points').optional().isInt({ min: 0, max: 1000 }).withMessage('points must be 0-1000'),
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
  mongoIdArray('questionResourceIds'),
  body('questionResourceIds.*').isMongoId().withMessage('Invalid resource id'),
  mongoIdArray('explanationResourceIds'),
  body('explanationResourceIds.*').isMongoId().withMessage('Invalid resource id'),
  body('options.*.resourceIds').optional().isArray(),
  body('options.*.resourceIds.*').isMongoId().withMessage('Invalid resource id'),
  body('tags').optional().isArray().withMessage('tags must be an array'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('difficulty must be easy, medium, or hard'),
  validateErrors
];

export const createCodeQuestionValidators = [
  body('points').optional().isInt({ min: 0, max: 1000 }).withMessage('points must be 0-1000'),
  body('referenceSolution.language')
    .optional()
    .isIn(JUDGE_LANGUAGES)
    .withMessage(`referenceSolution.language must be one of ${JUDGE_LANGUAGES.join(', ')}`),
  body('referenceSolution.code')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100_000 })
    .withMessage('referenceSolution.code is required (max 100KB)'),
  body('title').notEmpty().withMessage('title is required').trim(),
  body('description').notEmpty().withMessage('description is required').trim(),
  body('constraints').isArray().withMessage('constraints must be an array'),
  body('inputFormat').notEmpty().withMessage('inputFormat is required').trim(),
  body('outputFormat').notEmpty().withMessage('outputFormat is required').trim(),
  body('examples')
    .optional()
    .isArray({ max: 5 })
    .withMessage('examples must be an array with at most 5 items'),
  body('testCases')
    .optional()
    .isArray({ max: 100 })
    .withMessage('testCases must be an array with at most 100 items'),
  body('testCases.*.input').isString().withMessage('Each test case needs an input string'),
  body('testCases.*.expectedOutput')
    .isString()
    .withMessage('Each test case needs an expectedOutput string'),
  body('testCaseGeneration.requestedCount').optional().isInt({ min: 0, max: 100 }),
  body('supportedLanguages')
    .isArray({ min: 1 })
    .withMessage('supportedLanguages must be an array with at least one language'),
  body('supportedLanguages.*')
    .isIn(JUDGE_LANGUAGES)
    .withMessage(`languages must be one of ${JUDGE_LANGUAGES.join(', ')}`),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('difficulty must be easy, medium, or hard'),
  validateErrors
];

export const createSubmoduleValidators = [
  body('title').notEmpty().withMessage('title is required').trim(),
  body('courseId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid courseId'),
  body('description').optional().isString(),
  body('content').optional().isArray().withMessage('content must be an array'),
  body('content.*.type')
    .isIn(['video', 'resource', 'mcq', 'code-question'])
    .withMessage('content type must be video, resource, mcq or code-question'),
  body('content.*.resourceId').optional().isMongoId().withMessage('Invalid resourceId'),
  body('content.*.contentId').optional().isMongoId().withMessage('Invalid contentId'),
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
  body('submoduleIds.*').isMongoId().withMessage('Invalid submodule id'),
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
  body('modules.*').isMongoId().withMessage('Invalid module id'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('status must be draft, published, or archived'),
  validateErrors
];

export const addModuleValidators = [
  body('courseId').isMongoId().withMessage('Valid courseId is required'),
  body('moduleId').isMongoId().withMessage('Valid moduleId is required'),
  body('order').optional().isInt({ min: 1 }).withMessage('order must be a positive integer'),
  body('releasePolicy.releaseAt')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('releaseAt must be an ISO date'),
  validateErrors
];

export const checkMcqValidators = [
  body('mcqId').notEmpty().withMessage('mcqId is required').trim(),
  body('selectedOptionId').notEmpty().withMessage('selectedOptionId is required').trim(),
  validateErrors
];

export const runCodeValidators = [
  param('id').isMongoId().withMessage('Invalid id'),
  body('code')
    .isString()
    .isLength({ min: 1, max: 100_000 })
    .withMessage('code is required (max 100KB)'),
  body('language')
    .isIn(JUDGE_LANGUAGES)
    .withMessage(`language must be one of ${JUDGE_LANGUAGES.join(', ')}`),
  body('courseId').optional().isMongoId().withMessage('Invalid course ID'),
  validateErrors
];

export const idParamValidators = [
  param('id').isMongoId().withMessage('Invalid id'),
  validateErrors
];

export const courseModuleValidators = [
  body('courseId').isMongoId().withMessage('Valid courseId is required'),
  body('moduleId').isMongoId().withMessage('Valid moduleId is required'),
  validateErrors
];

export const reorderModulesValidators = [
  body('courseId').isMongoId().withMessage('Valid courseId is required'),
  body('moduleIds').isArray({ min: 1 }).withMessage('moduleIds must be a non-empty array'),
  body('moduleIds.*').isMongoId().withMessage('Invalid module id'),
  validateErrors
];
