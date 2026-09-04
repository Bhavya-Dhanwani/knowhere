import express from 'express';
import CodingController from './question.controller.js';
import {
  createQuestionValidators,
  getQuestionDisplayValidators,
  submitCodeValidators,
  getSubmissionValidators
} from './question.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const codingController = new CodingController();

/*
    @route POST /api/coding/questions
    @desc Create coding problem with testcases
    @access Trainer/Admin
*/
router.post(
  '/questions',
  authMiddleware,
  requireRole('admin', 'trainer'),
  createQuestionValidators,
  codingController.createQuestion
);

/*
    @route GET /api/coding/questions/:id/display
    @desc Get problem details for trainee (hidden test cases stripped)
    @access Private
*/
router.get(
  '/questions/:id/display',
  authMiddleware,
  getQuestionDisplayValidators,
  codingController.getQuestionDisplay
);

/*
    @route POST /api/coding/questions/:id/submit
    @desc Submit solution (unlimited attempts, queued in worker)
    @access Private
*/
router.post(
  '/questions/:id/submit',
  authMiddleware,
  submitCodeValidators,
  codingController.submitCode
);

/*
    @route GET /api/coding/submissions/:id
    @desc Poll submission evaluation status and results
    @access Private
*/
router.get(
  '/submissions/:id',
  authMiddleware,
  getSubmissionValidators,
  codingController.getSubmission
);

export default router;
