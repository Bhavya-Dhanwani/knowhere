import { Types } from 'mongoose';
import {
  EvaluationWorkflowInput,
  EvaluationWorkflowResult,
  ActivityExecutionSnapshot
} from './types.js';
import EvaluationActivities from './evaluation.activities.js';
import { BuildRunner } from '../runners/build.runner.js';
import { ReplayTrace } from '../../models/ReplayTrace.model.js';
import { ReviewSubmission, IReviewSubmission } from '../../models/Submission.model.js';
import { ReviewEvent, IReviewEvent } from '../../models/Event.model.js';
import { EvaluationLogger } from '../logging/evaluation-logger.service.js';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';

/** Statuses of a submission that a worker is currently evaluating. */
export const IN_FLIGHT = ['DISCOVERING', 'SANITIZING', 'ANALYZING', 'SCORING'];

// A worker holds a lease on the submission it evaluates and renews it every minute; any replica
// may requeue work whose lease ran out (its worker died), so replicas and restarts are both safe.
export const LEASE_MS = 3 * 60_000;
const lease = () => new Date(Date.now() + LEASE_MS);
const draining = new Set<string>(); // events this process is draining right now

export const toWorkflowInput = (
  submission: IReviewSubmission,
  event: IReviewEvent
): EvaluationWorkflowInput => ({
  submissionId: submission._id.toString(),
  eventId: event._id.toString(),
  repoUrl: submission.repositoryUrl,
  // pinned commit when we have one: re-runs score exactly what was submitted
  branch: submission.commitHash || submission.branch,
  liveSiteUrl: submission.liveSiteUrl,
  apiSpecUrl: submission.apiSpecUrl,
  rawReadme: submission.rawReadmeText,
  formFields: event.formFields,
  formResponses: submission.formResponses,
  ioTests: event.ioTests,
  runCommand: event.runCommand
});

export class WorkflowRunner {
  /**
   * Dispatches and executes the project evaluation workflow.
   * Tracks activity execution duration, snapshots inputs/outputs,
   * and persists complete replay history (Â§20 Evaluation Replay).
   */
  public static async executeEvaluation(
    input: EvaluationWorkflowInput
  ): Promise<EvaluationWorkflowResult> {
    const workflowId = `wf-review-${input.submissionId}-${Date.now()}`;
    const workflowStart = Date.now();
    const activitiesTrace: ActivityExecutionSnapshot[] = [];

    logger.info(
      { workflowId, submissionId: input.submissionId },
      'Starting durable evaluation workflow execution'
    );

    // Initialize granular execution logging to disk
    EvaluationLogger.initRun(input.submissionId, workflowId, {
      repoUrl: input.repoUrl,
      branch: input.branch,
      eventId: input.eventId,
      liveSiteUrl: input.liveSiteUrl
    });

    // Update submission status to DISCOVERING
    // a re-run starts clean: an old injection flag must not stick if the content was fixed
    await ReviewSubmission.findByIdAndUpdate(input.submissionId, {
      status: 'DISCOVERING',
      currentWorkflowId: workflowId,
      leaseUntil: lease(),
      flaggedForHumanReview: false,
      $unset: { flagReason: 1 }
    });

    const heartbeat = setInterval(
      () =>
        ReviewSubmission.updateOne({ _id: input.submissionId }, { leaseUntil: lease() }).catch(
          () => {}
        ),
      60_000
    );
    let overallFinalStatus: EvaluationWorkflowResult['status'] = 'SUCCESS';
    let overallScore: number | undefined;
    let flaggedForHumanReview = false;

    // Helper to wrap activity execution with durable tracing
    const runTrackedActivity = async <T>(
      activityName: string,
      fn: () => Promise<T>,
      inputSnapshot?: unknown
    ): Promise<T> => {
      const actStart = new Date();
      const actStartMs = Date.now();
      try {
        const outputSnapshot = await fn();
        activitiesTrace.push({
          activityName,
          status: 'COMPLETED',
          startedAt: actStart,
          completedAt: new Date(),
          durationMs: Date.now() - actStartMs,
          inputSnapshot,
          outputSnapshot
        });
        return outputSnapshot;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        activitiesTrace.push({
          activityName,
          status: 'FAILED',
          startedAt: actStart,
          completedAt: new Date(),
          durationMs: Date.now() - actStartMs,
          inputSnapshot,
          error: errMsg
        });
        throw err;
      }
    };

    try {
      // Step 1: Discovery Activity
      const discovery = await runTrackedActivity(
        'ProjectDiscoveryActivity',
        () =>
          EvaluationActivities.runDiscoveryActivity(
            input.submissionId,
            input.repoUrl,
            input.branch
          ),
        { repoUrl: input.repoUrl, branch: input.branch }
      );
      EvaluationLogger.logStep(
        input.submissionId,
        workflowId,
        1,
        'ProjectDiscoveryActivity',
        { repoUrl: input.repoUrl, branch: input.branch },
        discovery
      );

      // Step 2: Content Sanitization & Injection Defense Activity
      await ReviewSubmission.findByIdAndUpdate(input.submissionId, { status: 'SANITIZING' });
      // the organiser's custom form answers are untrusted student text: they go through the same
      // injection defense + claim extraction as the README, so scoring sees them as claims
      const formAnswers = (input.formFields || [])
        .filter((f) => input.formResponses?.[f.id])
        .map((f) => `### ${f.label}\n${input.formResponses![f.id]}`)
        .join('\n\n');
      const rawReadme = [
        input.rawReadme || discovery.rawReadme || '',
        formAnswers && `## Submission form answers\n\n${formAnswers}`
      ]
        .filter(Boolean)
        .join('\n\n');
      const sanitization = await runTrackedActivity(
        'SanitizationDefenseActivity',
        () =>
          EvaluationActivities.runSanitizationActivity(
            input.submissionId,
            input.eventId,
            rawReadme,
            input.liveSiteUrl
          ),
        { rawReadmeLength: rawReadme.length, liveUrl: input.liveSiteUrl }
      );
      EvaluationLogger.logStep(
        input.submissionId,
        workflowId,
        2,
        'SanitizationDefenseActivity',
        { rawReadmeLength: rawReadme.length, liveUrl: input.liveSiteUrl },
        sanitization
      );

      if (sanitization.humanReviewRequired) {
        flaggedForHumanReview = true;
        overallFinalStatus = 'FLAGGED';
        await ReviewSubmission.findByIdAndUpdate(input.submissionId, {
          flaggedForHumanReview: true,
          flagReason: 'Submission content was flagged by prompt-injection defense.'
        });
      }

      // Step 3: Analysis DAG (Selective based on Event Project Scope)
      await ReviewSubmission.findByIdAndUpdate(input.submissionId, { status: 'ANALYZING' });
      const eventDoc = await ReviewEvent.findById(input.eventId).lean();
      const projectType = eventDoc?.projectType || 'FULLSTACK';

      const codeAnalysisPromise = runTrackedActivity(
        'CodeAnalysisActivity',
        () =>
          EvaluationActivities.runCodeAnalysisActivity(
            input.submissionId,
            input.repoUrl,
            discovery.keyFileSnippets || {},
            discovery.fileList || []
          ),
        { repoUrl: input.repoUrl, filesInspected: discovery.fileList?.length || 0 }
      );

      const frontendEvalPromise =
        projectType === 'BACKEND'
          ? Promise.resolve({
              tool: 'Playwright + Lighthouse + axe-core' as const,
              lighthouse: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
              axeViolationsCount: 0,
              consoleErrorsCount: 0,
              failedRequestsCount: 0
            })
          : runTrackedActivity(
              'FrontendEvalActivity',
              () =>
                EvaluationActivities.runFrontendEvalActivity(
                  input.submissionId,
                  input.liveSiteUrl,
                  discovery.keyFileSnippets || {},
                  discovery.fileList || []
                ),
              { liveSiteUrl: input.liveSiteUrl, filesInspected: discovery.fileList?.length || 0 }
            );

      const backendEvalPromise =
        projectType === 'FRONTEND'
          ? Promise.resolve({
              tool: 'Schemathesis + OWASP ZAP + k6' as const,
              schemathesis: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                flaky: 0,
                endpointsTested: 0,
                failures: []
              }
            })
          : runTrackedActivity(
              'BackendEvalActivity',
              () =>
                EvaluationActivities.runBackendEvalActivity(
                  input.submissionId,
                  input.apiSpecUrl,
                  input.liveSiteUrl
                ),
              { apiSpecUrl: input.apiSpecUrl, targetUrl: input.liveSiteUrl }
            );

      // build + tests in the judge sandbox, at the pinned commit (input.branch is the sha)
      const buildEvalPromise = runTrackedActivity(
        'BuildAndTestActivity',
        () =>
          BuildRunner.run(input.repoUrl, input.branch || 'main', {
            ioTests: input.ioTests,
            runCommand: input.runCommand
          }),
        { repoUrl: input.repoUrl, ref: input.branch }
      );

      const [codeAnalysis, frontendEval, backendEval, buildEval] = await Promise.all([
        codeAnalysisPromise,
        frontendEvalPromise,
        backendEvalPromise,
        buildEvalPromise
      ]);

      EvaluationLogger.logStep(
        input.submissionId,
        workflowId,
        3,
        'CodeAndFrontendAnalysisActivity',
        {
          repoUrl: input.repoUrl,
          liveSiteUrl: input.liveSiteUrl,
          projectType
        },
        { codeAnalysis, frontendEval, backendEval, buildEval }
      );

      // Step 4: Assemble & Persist Evidence
      const assembledEvidence = await runTrackedActivity('AssembleEvidenceActivity', () =>
        EvaluationActivities.assembleEvidenceActivity(
          input.submissionId,
          input.eventId,
          discovery,
          codeAnalysis,
          frontendEval,
          backendEval,
          buildEval
        )
      );
      EvaluationLogger.logStep(
        input.submissionId,
        workflowId,
        4,
        'AssembleEvidenceActivity',
        { submissionId: input.submissionId, eventId: input.eventId },
        assembledEvidence
      );

      // Step 5: Scoring Engine (Evidence-Grounded)
      await ReviewSubmission.findByIdAndUpdate(input.submissionId, { status: 'SCORING' });
      const scoreResult = await runTrackedActivity(
        'EvidenceGroundedScoringActivity',
        () => EvaluationActivities.runScoringActivity(input.submissionId, input.eventId),
        { submissionId: input.submissionId, eventId: input.eventId }
      );
      EvaluationLogger.logStep(
        input.submissionId,
        workflowId,
        5,
        'EvidenceGroundedScoringActivity',
        { submissionId: input.submissionId, eventId: input.eventId },
        scoreResult
      );

      overallScore = scoreResult.overallScore;

      // Final status update on submission
      await ReviewSubmission.findByIdAndUpdate(input.submissionId, {
        status: flaggedForHumanReview ? 'FLAGGED_FOR_REVIEW' : 'EVALUATED'
      });

      // Auto-recalibrate relative rankings and comparative insights for the event
      if (!input.skipRanking) {
        try {
          const { RankingService } = await import('../ranking/ranking.service.js');
          const rankingResult = await RankingService.rankEvent(input.eventId);
          EvaluationLogger.logStep(
            input.submissionId,
            workflowId,
            6,
            'RelativeRankingActivity',
            { eventId: input.eventId },
            rankingResult
          );
        } catch (rankErr) {
          logger.warn(
            { rankErr, eventId: input.eventId },
            'Automatic post-evaluation relative ranking generation failed'
          );
          EvaluationLogger.logStep(
            input.submissionId,
            workflowId,
            6,
            'RelativeRankingActivity',
            { eventId: input.eventId },
            null,
            {
              status: 'FAILED',
              error: rankErr instanceof Error ? rankErr.message : String(rankErr)
            }
          );
        }
      }
    } catch (err: unknown) {
      logger.error({ err, workflowId }, 'Evaluation workflow failed during activity execution');
      overallFinalStatus = 'FAILED';
      await ReviewSubmission.findByIdAndUpdate(input.submissionId, { status: 'FAILED' });
    }

    clearInterval(heartbeat);
    await ReviewSubmission.updateOne({ _id: input.submissionId }, { $unset: { leaseUntil: 1 } });
    const totalDurationMs = Date.now() - workflowStart;

    // Finalize human-readable execution summary Markdown
    EvaluationLogger.finalizeRunSummary(input.submissionId, workflowId, {
      finalStatus: overallFinalStatus,
      totalDurationMs,
      overallScore,
      steps: activitiesTrace.map((act) => ({
        name: act.activityName,
        durationMs: act.durationMs,
        status: act.status,
        keyTakeaway: act.error ? `Error: ${act.error}` : undefined
      }))
    });

    // Step 6: Persist Replay Trace (Â§20 Evaluation Replay)
    await ReplayTrace.create({
      workflowId,
      submissionId: new Types.ObjectId(input.submissionId),
      eventId: new Types.ObjectId(input.eventId),
      activities: activitiesTrace,
      executedBy: env.TEMPORAL_ADDRESS ? 'TEMPORAL' : 'EMBEDDED_DURABLE_RUNNER',
      finalStatus: overallFinalStatus,
      totalDurationMs
    });

    logger.info(
      { workflowId, finalStatus: overallFinalStatus, totalDurationMs },
      'Evaluation workflow completed and replay trace persisted'
    );

    return {
      workflowId,
      submissionId: input.submissionId,
      eventId: input.eventId,
      status: overallFinalStatus,
      overallScore,
      flaggedForHumanReview,
      activitiesTrace,
      totalDurationMs
    };
  }

  /**
   * Evaluates every QUEUED submission of an event, `concurrency` at a time, then ranks once.
   * The queue lives in Mongo (status QUEUED) and each claim is atomic, so any number of
   * replicas can drain the same event; the ranking only runs once nothing is left anywhere.
   */
  public static async drainEvent(
    eventId: string,
    concurrency = env.REVIEW_CONCURRENCY
  ): Promise<void> {
    if (draining.has(eventId)) return;
    const event = await ReviewEvent.findById(eventId);
    if (!event) return;
    draining.add(eventId);
    try {
      logger.info({ eventId, concurrency }, 'Draining evaluation queue');
      const worker = async () => {
        for (;;) {
          const sub = await ReviewSubmission.findOneAndUpdate(
            { eventId, status: 'QUEUED' },
            { status: 'DISCOVERING', leaseUntil: lease() },
            { sort: { createdAt: 1 }, new: true }
          );
          if (!sub) return;
          await WorkflowRunner.executeEvaluation({
            ...toWorkflowInput(sub, event),
            skipRanking: true
          }).catch((err) =>
            logger.error({ err, submissionId: sub.id }, 'Queued evaluation failed')
          );
        }
      };
      await Promise.all(Array.from({ length: concurrency }, worker));
      // another replica still working on this event ranks it when it finishes
      if (await ReviewSubmission.exists({ eventId, status: { $in: ['QUEUED', ...IN_FLIGHT] } })) {
        logger.info({ eventId }, 'Queue empty here; another worker is still evaluating this event');
        return;
      }
      const { RankingService } = await import('../ranking/ranking.service.js');
      await RankingService.rankEvent(eventId);
      logger.info({ eventId }, 'Evaluation queue drained and event ranked');
    } finally {
      draining.delete(eventId);
    }
  }

  /**
   * Requeues work whose worker died (lease expired, or no lease from before leases existed) and
   * drains every event with queued work. Runs at boot and then every minute on every replica.
   */
  public static async resumeInterrupted(): Promise<void> {
    await ReviewSubmission.updateMany(
      {
        status: { $in: IN_FLIGHT },
        $or: [{ leaseUntil: { $lt: new Date() } }, { leaseUntil: { $exists: false } }]
      },
      { status: 'QUEUED', $unset: { leaseUntil: 1 } }
    );
    const eventIds = await ReviewSubmission.distinct('eventId', { status: 'QUEUED' });
    for (const id of eventIds) {
      if (draining.has(String(id))) continue;
      logger.info({ eventId: id }, 'Resuming queued evaluation work');
      WorkflowRunner.drainEvent(String(id)).catch((err) =>
        logger.error({ err, eventId: id }, 'Resumed evaluation queue failed')
      );
    }
  }
}

/** Runs `fn` over `items` with at most `limit` in flight; one failure never stops the rest. */
export async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<unknown>
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item).catch((err) => logger.error({ err }, 'Batch item failed'));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export default WorkflowRunner;
