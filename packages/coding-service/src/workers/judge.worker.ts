import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { z } from 'zod';
import CodingSubmissionDao from '../shared/dao/submission.dao.js';
import CodingQuestionDao from '../shared/dao/question.dao.js';
import logger from '../shared/config/logger.config.js';
import env from '../shared/config/env.config.js';

const RunnerResultSchema = z.object({
  result: z.enum(['AC', 'WA', 'TLE', 'MLE', 'CE', 'RE']),
  passedTestCases: z.number().int().nonnegative(),
  totalTestCases: z.number().int().positive(),
  details: z.array(
    z.object({
      testCaseIndex: z.number().int().positive(),
      status: z.enum(['AC', 'WA', 'TLE', 'MLE', 'CE', 'RE']),
      timeMs: z.number().nonnegative(),
      memoryMb: z.number().nonnegative(),
      actualOutput: z.string().optional(),
      errorMessage: z.string().optional()
    })
  )
});

class JudgeWorker {
  submissionDao = new CodingSubmissionDao();
  questionDao = new CodingQuestionDao();
  private queue?: Queue<{ submissionId: string }>;
  private worker?: Worker<{ submissionId: string }>;

  private connection(): Redis {
    if (!env.REDIS_URL) throw new Error('REDIS_URL is required for durable coding jobs.');
    return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }

  async processSubmission(submissionId: string): Promise<void> {
    const submission = await this.submissionDao.findSubmissionById(submissionId);
    if (!submission) throw new Error(`Submission ${submissionId} not found.`);
    const question = await this.questionDao.findQuestionById(submission.questionId);
    if (!question) {
      await this.submissionDao.updateSubmissionResult(submissionId, {
        status: 'failed',
        scoreAwarded: 0,
        passedTestCases: 0,
        totalTestCases: 0
      });
      throw new Error(`Question ${submission.questionId} not found.`);
    }
    if (!env.CODING_RUNNER_URL) throw new Error('CODING_RUNNER_URL is not configured.');

    await this.submissionDao.updateSubmissionResult(submissionId, {
      status: 'running',
      scoreAwarded: 0,
      passedTestCases: 0,
      totalTestCases: question.testCases.length
    });
    const response = await fetch(env.CODING_RUNNER_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.CODING_RUNNER_TOKEN ? { authorization: `Bearer ${env.CODING_RUNNER_TOKEN}` } : {})
      },
      body: JSON.stringify({
        submissionId,
        language: submission.language,
        code: submission.code,
        testCases: question.testCases,
        limits: { timeMs: question.timeLimitMs, memoryMb: question.memoryLimitMb }
      }),
      signal: AbortSignal.timeout(env.JUDGE_WORKER_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`Coding runner returned HTTP ${response.status}.`);
    const result = RunnerResultSchema.parse(await response.json());
    if (
      result.totalTestCases !== question.testCases.length ||
      result.passedTestCases > result.totalTestCases ||
      result.details.length !== result.totalTestCases ||
      new Set(result.details.map((detail) => detail.testCaseIndex)).size !==
        result.totalTestCases ||
      (result.result === 'AC') !== (result.passedTestCases === result.totalTestCases)
    ) {
      throw new Error('Coding runner returned inconsistent test counts.');
    }
    const scoreAwarded = Math.round(
      (result.passedTestCases / result.totalTestCases) * question.max_score
    );
    await this.submissionDao.updateSubmissionResult(submissionId, {
      status: 'completed',
      result: result.result,
      scoreAwarded,
      passedTestCases: result.passedTestCases,
      totalTestCases: result.totalTestCases,
      details: result.details
    });
  }

  async queueSubmission(submissionId: string): Promise<void> {
    this.queue ??= new Queue('coding-submissions-v1', {
      connection: this.connection(),
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 3_000 } }
    });
    await this.queue.add('judge', { submissionId }, { jobId: submissionId });
  }

  start(): void {
    if (!env.REDIS_URL || this.worker) return;
    this.worker = new Worker(
      'coding-submissions-v1',
      (job: Job<{ submissionId: string }>) => this.processSubmission(job.data.submissionId),
      { connection: this.connection() }
    );
    this.worker.on('failed', async (job, error) => {
      logger.error({ error, submissionId: job?.data.submissionId }, 'Coding judge job failed');
      if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
        await this.submissionDao.updateSubmissionResult(job.data.submissionId, {
          status: 'failed',
          scoreAwarded: 0,
          passedTestCases: 0,
          totalTestCases: 0
        });
      }
    });
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}

export default new JudgeWorker();
