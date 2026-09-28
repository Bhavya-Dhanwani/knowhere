import express from 'express';
import { body, param } from 'express-validator';
import CertificateController from './certificate.controller.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';
import validateErrors from '../../shared/utils/validateErrors.util.js';

const router = express.Router();
const controller = new CertificateController();
const anyRole = [authMiddleware, requireRole('admin', 'trainer', 'trainee')];
const staff = [authMiddleware, requireRole('admin', 'trainer')];
const courseId = [param('courseId').isMongoId().withMessage('Invalid course ID'), validateErrors];

// @route GET /api/courses/certificates/verify/:code — public verification (QR target)
router.get('/certificates/verify/:code', controller.verify);

// @route GET /api/courses/certificates/mine — the caller's certificates
router.get('/certificates/mine', anyRole, controller.listMine);

// @route GET /api/courses/:courseId/certificate — eligibility + the certificate if issued
router.get('/:courseId/certificate', anyRole, courseId, controller.getMine);

// @route POST /api/courses/:courseId/certificate — issue it once the course is completed
router.post('/:courseId/certificate', anyRole, courseId, controller.claim);

// @route GET /api/courses/:courseId/certificates — staff: every learner, completion, certificate
router.get('/:courseId/certificates', staff, courseId, controller.listForCourse);

// @route POST /api/courses/:courseId/certificates/issue — staff: issue to many learners at once
router.post(
  '/:courseId/certificates/issue',
  staff,
  courseId,
  body('userIds').isArray({ min: 1, max: 1000 }).withMessage('userIds must list 1-1000 learners'),
  body('userIds.*').isString().notEmpty(),
  validateErrors,
  controller.issueBulk
);

export default router;
