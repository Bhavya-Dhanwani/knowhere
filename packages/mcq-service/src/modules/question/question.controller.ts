import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import QuestionDao from '../../shared/dao/question.dao.js';
import AttemptDao from '../../shared/dao/attempt.dao.js';
import {
  sanitizeQuestionForDisplay,
  sanitizeQuestionFull
} from '../../shared/sanitizers/question.sanitizer.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';
import BadRequest from '../../shared/errors/BadRequest.error.js';

class QuestionController {
  questionDao: QuestionDao;
  attemptDao: AttemptDao;

  constructor() {
    this.questionDao = new QuestionDao();
    this.attemptDao = new AttemptDao();
  }

  // POST /questions
  createQuestion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { title, stem, options, correct_option_id, max_score, explanation } = req.body;
      const creatorId = req.user!.userId;

      // Ensure correct_option_id matches one of the option IDs
      const validOption = options.some((o: any) => o.id === correct_option_id);
      if (!validOption) {
        throw new BadRequest(
          `correct_option_id '${correct_option_id}' does not match any provided options.`
        );
      }

      const question = await this.questionDao.createQuestion({
        title,
        stem,
        options,
        correct_option_id,
        max_score: max_score || 1,
        explanation: explanation || '',
        creatorId
      });

      return Created(
        res,
        'Question created successfully',
        sanitizeQuestionFull(question.toObject())
      );
    } catch (error) {
      next(error);
    }
  };

  // GET /questions/:id/display
  // Strips correct_option_id via DB query projection (.select('-correct_option_id'))
  getQuestionDisplay = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;

      const question = await this.questionDao.findQuestionForDisplay(id);
      if (!question) {
        throw new NotFound(`Question with ID '${id}' not found.`);
      }

      return Ok(
        res,
        'Question retrieved successfully for display',
        sanitizeQuestionForDisplay(question)
      );
    } catch (error) {
      next(error);
    }
  };

  // POST /questions/:id/submit
  // Strict 3-strike logic: max 3 attempts. 4th attempt is strictly rejected with 403 Forbidden.
  submitAttempt = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const questionId = Array.isArray(rawId) ? rawId[0] : rawId;
      const userId = req.user!.userId;
      const { selected_option_id } = req.body;

      const question = await this.questionDao.findQuestionById(questionId);
      if (!question) {
        throw new NotFound(`Question with ID '${questionId}' not found.`);
      }

      // Check current attempt count
      const attemptCount = await this.attemptDao.getAttemptCount(questionId, userId);
      if (attemptCount >= 3) {
        throw new Forbidden('Maximum attempt limit (3) reached for this question.');
      }

      const attemptNumber = attemptCount + 1;
      const isCorrect = selected_option_id === question.correct_option_id;
      const scoreAwarded = isCorrect ? question.max_score : 0;

      const attempt = await this.attemptDao.createAttempt({
        questionId,
        userId,
        attemptNumber,
        selected_option_id,
        isCorrect,
        scoreAwarded
      });

      return Ok(res, 'Attempt submitted successfully', {
        attemptNumber,
        attemptsRemaining: 3 - attemptNumber,
        isCorrect,
        scoreAwarded,
        explanation: isCorrect || attemptNumber === 3 ? question.explanation : undefined,
        attemptId: attempt._id
      });
    } catch (error) {
      next(error);
    }
  };
}

export default QuestionController;
