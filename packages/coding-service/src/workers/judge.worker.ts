import CodingSubmissionDao from '../shared/dao/submission.dao.js';
import CodingQuestionDao from '../shared/dao/question.dao.js';
import logger from '../shared/config/logger.config.js';

class JudgeWorker {
  submissionDao: CodingSubmissionDao;
  questionDao: CodingQuestionDao;

  constructor() {
    this.submissionDao = new CodingSubmissionDao();
    this.questionDao = new CodingQuestionDao();
  }

  /**
   * Evaluates submission asynchronously in isolated worker logic.
   * Simulates sandboxed execution with mock run for supported languages.
   */
  async processSubmission(submissionId: string): Promise<void> {
    logger.info(`JudgeWorker started processing submission: ${submissionId}`);

    try {
      const submission = await this.submissionDao.findSubmissionById(submissionId);
      if (!submission) {
        logger.error(`Submission ${submissionId} not found by JudgeWorker`);
        return;
      }

      await this.submissionDao.updateSubmissionResult(submissionId, {
        status: 'running',
        scoreAwarded: 0,
        passedTestCases: 0,
        totalTestCases: 0
      });

      const question = await this.questionDao.findQuestionById(submission.questionId);
      if (!question) {
        logger.error(`Question ${submission.questionId} not found`);
        return;
      }

      const totalTestCases = question.testCases.length;
      // Evaluate mock execution: if code contains "error", simulate RE, else AC
      let result: 'AC' | 'WA' | 'RE' = 'AC';
      let passedTestCases = totalTestCases;
      let scoreAwarded = question.max_score;

      if (submission.code.includes('syntax_error')) {
        result = 'RE';
        passedTestCases = 0;
        scoreAwarded = 0;
      } else if (submission.code.includes('wrong_answer')) {
        result = 'WA';
        passedTestCases = Math.floor(totalTestCases / 2);
        scoreAwarded = Math.floor(question.max_score / 2);
      }

      await this.submissionDao.updateSubmissionResult(submissionId, {
        status: 'completed',
        result,
        scoreAwarded,
        passedTestCases,
        totalTestCases,
        details: question.testCases.map((tc, idx) => ({
          testCaseIndex: idx + 1,
          status: result === 'AC' ? 'AC' : idx === 0 ? 'AC' : result,
          timeMs: 45,
          memoryMb: 12
        }))
      });

      logger.info(`JudgeWorker finished submission ${submissionId} with result: ${result}`);
    } catch (err) {
      logger.error({ err }, `JudgeWorker failed for submission ${submissionId}`);
      await this.submissionDao.updateSubmissionResult(submissionId, {
        status: 'failed',
        scoreAwarded: 0,
        passedTestCases: 0,
        totalTestCases: 0
      });
    }
  }

  queueSubmission(submissionId: string): void {
    // Fire-and-forget async invocation in isolated queue/worker
    setImmediate(() => {
      this.processSubmission(submissionId).catch((err) =>
        logger.error({ err }, `Uncaught error in queueSubmission: ${submissionId}`)
      );
    });
  }
}

export default new JudgeWorker();
