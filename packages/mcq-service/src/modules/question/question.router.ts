import express from 'express';
import QuestionController from './question.controller.js';
import {
  createQuestionValidators,
  getQuestionDisplayValidators,
  submitAttemptValidators
} from './question.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const questionController = new QuestionController();

/*
    @route POST /api/questions
    @desc Create new MCQ question
    @access Trainer/Admin
*/
router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'trainer'),
  createQuestionValidators,
  questionController.createQuestion
);

/*
    @route GET /api/questions/:id/display
    @desc Get question for trainee display (strips correct_option_id via DB query projection)
    @access Private
*/
router.get(
  '/:id/display',
  authMiddleware,
  getQuestionDisplayValidators,
  questionController.getQuestionDisplay
);

/*
    @route POST /api/questions/:id/submit
    @desc Submit answer attempt (strict 3-strike logic, 4th attempt rejected)
    @access Private
*/
router.post(
  '/:id/submit',
  authMiddleware,
  submitAttemptValidators,
  questionController.submitAttempt
);

export default router;
