import { Redis } from 'ioredis';
import { Job, Queue, Worker } from 'bullmq';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';
import { ReviewSubmission } from '../../models/Submission.model.js';
import { EvaluationWorkflowInput, EvaluationWorkflowResult } from './types.js';
import { WorkflowRunner } from './workflow.runner.js';

const QUEUE_NAME = 'project-evaluations-v1';
let queue: Queue<EvaluationWorkflowInput, EvaluationWorkflowResult> | undefined;
let worker: Worker<EvaluationWorkflowInput, EvaluationWorkflowResult> | undefined;

const createConnection = () => {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is required to enqueue durable project evaluations.');
  }
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });
};

export class EvaluationQueue {
  public static async enqueue(input: EvaluationWorkflowInput): Promise<string> {
    queue ??= new Queue<EvaluationWorkflowInput, EvaluationWorkflowResult>(QUEUE_NAME, {
      connection: createConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
        removeOnFail: { age: 30 * 24 * 60 * 60, count: 25_000 }
      }
    });
    const job = await queue.add('evaluate-submission', input, {
      jobId: input.workflowId
    });
    return job.id!;
  }

  public static startWorker(): Worker<EvaluationWorkflowInput, EvaluationWorkflowResult> | null {
    if (!env.REDIS_URL) {
      logger.warn('REDIS_URL is not configured; evaluation worker is disabled');
      return null;
    }
    if (worker) return worker;
    worker = new Worker<EvaluationWorkflowInput, EvaluationWorkflowResult>(
      QUEUE_NAME,
      async (job: Job<EvaluationWorkflowInput>) => {
        logger.info(
          { jobId: job.id, submissionId: job.data.submissionId },
          'Evaluation job started'
        );
        return WorkflowRunner.executeEvaluation(job.data);
      },
      { connection: createConnection(), concurrency: env.EVALUATION_WORKER_CONCURRENCY }
    );
    worker.on('failed', async (job, error) => {
      logger.error({ jobId: job?.id, error }, 'Evaluation queue job failed');
      if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
        await ReviewSubmission.updateOne(
          { _id: job.data.submissionId, currentWorkflowId: job.data.workflowId },
          { status: 'FAILED' }
        );
      }
    });
    return worker;
  }

  public static async reconcileQueued(): Promise<number> {
    await ReviewSubmission.updateMany(
      { status: 'UPDATING' },
      { $set: { status: 'SUBMITTED' }, $unset: { currentWorkflowId: 1 } }
    );
    const queued = await ReviewSubmission.find({ status: 'QUEUED' }).lean();
    let reconciled = 0;
    for (const submission of queued) {
      if (!submission.currentWorkflowId) {
        await ReviewSubmission.updateOne(
          { _id: submission._id, status: 'QUEUED' },
          { status: 'FAILED' }
        );
        continue;
      }
      await this.enqueue({
        workflowId: submission.currentWorkflowId,
        submissionId: submission._id.toString(),
        eventId: submission.eventId.toString(),
        repoUrl: submission.repositoryUrl,
        branch: submission.branch,
        commitHash: submission.commitHash,
        liveSiteUrl: submission.liveSiteUrl,
        apiSpecUrl: submission.apiSpecUrl,
        rawReadme: submission.rawReadmeText
      });
      reconciled++;
    }
    if (reconciled > 0) logger.info({ reconciled }, 'Reconciled queued evaluations after startup');
    return reconciled;
  }

  public static async close(): Promise<void> {
    await worker?.close();
    await queue?.close();
    worker = undefined;
    queue = undefined;
  }
}

export default EvaluationQueue;
