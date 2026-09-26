import CodingSubmissionDao from '../shared/dao/submission.dao.js';
import CodingQuestionDao from '../shared/dao/question.dao.js';
import logger from '../shared/config/logger.config.js';
import { judgeCode } from '@lms/shared';
import env from '../shared/config/env.config.js';

class JudgeWorker {
  submissionDao: CodingSubmissionDao;
  questionDao: CodingQuestionDao;

  constructor() {
    this.submissionDao = new CodingSubmissionDao();
    this.questionDao = new CodingQuestionDao();
  }

  // Judges a submission against every test case with the shared sandboxed JS judge.
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
      const language =
        submission.language.toLowerCase() === 'js'
          ? 'javascript'
          : submission.language.toLowerCase();
      const verdict = await judgeCode(language, submission.code, question.testCases, {
        runnerUrl: env.JUDGE_URL,
        caseMs: question.timeLimitMs || 2000
      });

      const result: 'AC' | 'WA' | 'TLE' | 'CE' | 'RE' =
        verdict.passed === totalTestCases
          ? 'AC'
          : /timed out|time limit/i.test(verdict.error || '')
            ? 'TLE'
            : /^Test \d+:/.test(verdict.error || '')
              ? 'RE'
              : /^Wrong answer/.test(verdict.error || '')
                ? 'WA'
                : 'CE';
      const scoreAwarded = totalTestCases
        ? Math.round((verdict.passed / totalTestCases) * question.max_score)
        : 0;

      await this.submissionDao.updateSubmissionResult(submissionId, {
        status: 'completed',
        result,
        scoreAwarded,
        passedTestCases: verdict.passed,
        totalTestCases
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
