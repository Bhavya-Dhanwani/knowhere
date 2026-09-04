// Importing modules
import express from 'express';
import ProgressController from './progress.controller.js';
import { completeItemValidators, getProgressValidators } from './progress.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const progressController = new ProgressController();

/*
    @route POST /api/courses/:courseId/content-items/:itemId/complete
    @desc Mark content item complete and reward marks to student account for that course
    @access Private (Student/Trainee)
*/
router.post(
  '/:courseId/content-items/:itemId/complete',
  authMiddleware,
  completeItemValidators,
  progressController.completeItem
);

/*
    @route GET /api/courses/:courseId/my-progress
    @desc Get current student marks and progress for a course
    @access Private
*/
router.get(
  '/:courseId/my-progress',
  authMiddleware,
  getProgressValidators,
  progressController.getMyProgress
);

/*
    @route GET /api/courses/:courseId/grades
    @desc Get all students grades and progress in a course
    @access Trainer/Admin
*/
router.get(
  '/:courseId/grades',
  authMiddleware,
  requireRole('admin', 'trainer'),
  getProgressValidators,
  progressController.getCourseGrades
);

export default router;
