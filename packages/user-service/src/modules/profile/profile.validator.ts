// Importing modules
import { body } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';
import { usernameError } from '../../shared/utils/username.util.js';

// links end up as <a href> on a public page: only http(s), never javascript: or data:
const httpUrl = (field: string) =>
  body(field)
    .optional({ values: 'falsy' })
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`${field} must be an http(s) link`);
const text = (field: string, max: number) =>
  body(field)
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max })
    .withMessage(`${field}: at most ${max} characters`);
const yearish = (field: string) =>
  body(field).optional({ values: 'falsy' }).isInt({ min: 1950, max: 2100 }).toInt();
const month = (field: string) =>
  body(field)
    .optional({ values: 'falsy' })
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage(`${field} must be YYYY-MM`);

export const updateProfileValidators = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),

  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  body('phone').optional().isString().trim().withMessage('Phone must be a valid string'),

  body('username')
    .optional()
    .isString()
    .trim()
    .toLowerCase()
    .custom((u: string) => {
      const error = usernameError(u);
      if (error) throw new Error(error);
      return true;
    }),
  body('visibility').optional().isIn(['public', 'members', 'private']),
  text('headline', 120),
  text('location', 80),
  httpUrl('avatar'),

  body('links').optional().isArray({ max: 8 }).withMessage('At most 8 links'),
  text('links.*.label', 40),
  httpUrl('links.*.url'),

  body('skills').optional().isArray({ max: 50 }).withMessage('At most 50 skills'),
  text('skills.*', 40),
  body('interests').optional().isArray({ max: 30 }).withMessage('At most 30 interests'),
  text('interests.*', 40),

  body('qualifications').optional().isArray({ max: 20 }),
  text('qualifications.*.degree', 100),
  text('qualifications.*.field', 100),
  text('qualifications.*.institution', 120),
  text('qualifications.*.grade', 40),
  yearish('qualifications.*.startYear'),
  yearish('qualifications.*.endYear'),

  body('experience').optional().isArray({ max: 30 }),
  text('experience.*.title', 100),
  text('experience.*.organization', 120),
  text('experience.*.location', 80),
  text('experience.*.description', 1000),
  month('experience.*.startDate'),
  month('experience.*.endDate'),

  body('certificates').optional().isArray({ max: 50 }),
  text('certificates.*.name', 120),
  text('certificates.*.issuer', 120),
  text('certificates.*.credentialId', 80),
  month('certificates.*.issuedOn'),
  httpUrl('certificates.*.url'),

  validateErrors
];
