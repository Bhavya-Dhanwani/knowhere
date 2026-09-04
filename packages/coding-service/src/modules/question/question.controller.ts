import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import CodingQuestionDao from '../../shared/dao/question.dao.js';
import CodingSubmissionDao from '../../shared/dao/submission.dao.js';
import judgeWorker from '../../workers/judge.worker.js';
import {
  sanitizeCodingQuestionForDisplay,
  sanitizeCodingQuestionFull,
  sanitizeSubmission
} from '../../shared/sanitizers/coding.sanitizer.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';

class CodingController {
  questionDao: CodingQuestionDao;
  submissionDao: CodingSubmissionDao;

  constructor() {
    this.questionDao = new CodingQuestionDao();
    this.submissionDao = new CodingSubmissionDao();
  }

  // POST /questions
  createQuestion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { title, description, starterCode, testCases, timeLimitMs, memoryLimitMb, max_score } =
        req.body;
      const creatorId = req.user!.userId;

      const question = await this.questionDao.createQuestion({
        title,
        description,
        starterCode: starterCode || {},
        testCases,
        timeLimitMs: timeLimitMs || 2000,
        memoryLimitMb: memoryLimitMb || 128,
        max_score: max_score || 10,
        creatorId
      });

      return Created(
        res,
        'Coding question created successfully',
        sanitizeCodingQuestionFull(question.toObject())
      );
    } catch (error) {
      next(error);
    }
  };

  // GET /questions/:id/display
  // Strips hidden test cases from trainee display
  getQuestionDisplay = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;

      const question = await this.questionDao.findQuestionForDisplay(id);
      if (!question) {
        throw new NotFound(`Coding question with ID '${id}' not found.`);
      }

      return Ok(res, 'Question fetched for display', sanitizeCodingQuestionForDisplay(question));
    } catch (error) {
      next(error);
    }
  };

  // POST /questions/:id/submit
  // Unlimited attempts allowed. Queued in isolated judge worker.
  submitCode = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const questionId = Array.isArray(rawId) ? rawId[0] : rawId;
      const userId = req.user!.userId;
      const { language, code } = req.body;

      const question = await this.questionDao.findQuestionById(questionId);
      if (!question) {
        throw new NotFound(`Coding question with ID '${questionId}' not found.`);
      }

      const submission = await this.submissionDao.createSubmission({
        questionId,
        userId,
        language,
        code,
        status: 'queued',
        totalTestCases: question.testCases.length
      });

      // Delegate evaluation to background judge worker
      judgeWorker.queueSubmission(submission._id.toString());

      return Created(
        res,
        'Submission queued successfully',
        sanitizeSubmission(submission.toObject())
      );
    } catch (error) {
      next(error);
    }
  };

  // GET /submissions/:id
  getSubmission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;

      const submission = await this.submissionDao.findSubmissionById(id);
      if (!submission) {
        throw new NotFound(`Submission with ID '${id}' not found.`);
      }

      return Ok(res, 'Submission fetched successfully', sanitizeSubmission(submission.toObject()));
    } catch (error) {
      next(error);
    }
  };
}

export default CodingController;
