import { Types } from 'mongoose';
import {
  EvaluationWorkflowInput,
  EvaluationWorkflowResult,
  ActivityExecutionSnapshot
} from './types.js';
import EvaluationActivities from './evaluation.activities.js';
import { ReplayTrace } from '../../models/ReplayTrace.model.js';
import { ReviewSubmission } from '../../models/Submission.model.js';
import { ReviewEvent } from '../../models/Event.model.js';
import logger from '../../shared/config/logger.config.js';
import { RepositoryRunner } from '../runners/repository.runner.js';
import { RepositorySnapshot } from '../runners/types.js';
import { notApplicableExecution } from '../runners/trusted-process.runner.js';

export class WorkflowRunner {
  /**
   * Dispatches and executes the project evaluation workflow.
   * Tracks activity execution duration, snapshots inputs/outputs,
   * and persists complete replay history (§20 Evaluation Replay).
   */
  public static async executeEvaluation(
    input: EvaluationWorkflowInput
  ): Promise<EvaluationWorkflowResult> {
    const workflowId = input.workflowId;
    const workflowStart = Date.now();
    const existingTrace = await ReplayTrace.findOneAndUpdate(
      { workflowId },
      {
        $setOnInsert: {
          workflowId,
          submissionId: new Types.ObjectId(input.submissionId),
          eventId: new Types.ObjectId(input.eventId),
          activities: [],
          executedBy: 'EMBEDDED_DURABLE_RUNNER',
          finalStatus: 'RUNNING',
          totalDurationMs: 0
        }
      },
      { upsert: true, new: true }
    ).lean();
    let activitiesTrace: ActivityExecutionSnapshot[] = (existingTrace?.activities || []).map(
      (activity) => ({ ...activity })
    );

    logger.info(
      { workflowId, submissionId: input.submissionId },
      'Starting durable evaluation workflow execution'
    );

    // Update submission status to DISCOVERING
    const claimedSubmission = await ReviewSubmission.findOneAndUpdate(
      { _id: input.submissionId, currentWorkflowId: workflowId },
      { status: 'DISCOVERING' },
      { new: true }
    );
    if (!claimedSubmission) throw new Error('Evaluation workflow no longer owns this submission.');

    let overallFinalStatus: EvaluationWorkflowResult['status'] = 'SUCCESS';
    let overallScore: number | undefined;
    let flaggedForHumanReview = false;
    let repositorySnapshot: RepositorySnapshot | undefined;
    let workflowError: unknown;

    const persistActivity = async (snapshot: ActivityExecutionSnapshot) => {
      activitiesTrace = [
        ...activitiesTrace.filter((activity) => activity.activityId !== snapshot.activityId),
        snapshot
      ];
      await ReplayTrace.updateOne({ workflowId }, { $set: { activities: activitiesTrace } });
    };

    // Helper to wrap activity execution with durable tracing
    const runTrackedActivity = async <T>(
      activityName: string,
      fn: () => Promise<T>,
      inputSnapshot?: unknown
    ): Promise<T> => {
      const actStart = new Date();
      const actStartMs = Date.now();
      const activityId = `${workflowId}:${activityName}`;
      try {
        const outputSnapshot = await fn();
        await persistActivity({
          activityId,
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
        await persistActivity({
          activityId,
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
      // Step 1: Immutable repository acquisition
      await ReviewSubmission.updateOne(
        { _id: input.submissionId, currentWorkflowId: workflowId },
        { status: 'CLONING' }
      );
      const persistedSubmission = await ReviewSubmission.findById(input.submissionId)
        .select('commitHash')
        .lean();
      const pinnedCommit = persistedSubmission?.commitHash || input.commitHash;
      repositorySnapshot = await runTrackedActivity(
        'RepositoryAcquisitionActivity',
        () =>
          EvaluationActivities.runRepositoryAcquisitionActivity(
            input.submissionId,
            input.repoUrl,
            input.branch,
            pinnedCommit
          ),
        { repoUrl: input.repoUrl, branch: input.branch, requestedCommit: pinnedCommit }
      );
      await ReviewSubmission.updateOne(
        { _id: input.submissionId, currentWorkflowId: workflowId },
        { commitHash: repositorySnapshot.commitSha }
      );

      // Step 2: Complete repository discovery
      await ReviewSubmission.updateOne(
        { _id: input.submissionId, currentWorkflowId: workflowId },
        { status: 'DISCOVERING' }
      );
      const discovery = await runTrackedActivity(
        'ProjectDiscoveryActivity',
        () =>
          EvaluationActivities.runDiscoveryActivity(
            input.submissionId,
            repositorySnapshot!.localPath
          ),
        { commitSha: repositorySnapshot.commitSha }
      );

      // Step 3: Content Sanitization & Injection Defense Activity
      await ReviewSubmission.updateOne(
        { _id: input.submissionId, currentWorkflowId: workflowId },
        { status: 'SANITIZING' }
      );
      const rawReadme = input.rawReadme || discovery.rawReadme || '';
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

      if (sanitization.humanReviewRequired) {
        flaggedForHumanReview = true;
        overallFinalStatus = 'FLAGGED';
      }

      // Step 4: Analysis DAG (selective based on event project scope)
      await ReviewSubmission.updateOne(
        { _id: input.submissionId, currentWorkflowId: workflowId },
        { status: 'STATIC_ANALYSIS' }
      );
      const eventDoc = await ReviewEvent.findById(input.eventId).lean();
      const projectType = eventDoc?.projectType || 'FULLSTACK';

      const codeAnalysisPromise = runTrackedActivity(
        'CodeAnalysisActivity',
        () => EvaluationActivities.runCodeAnalysisActivity(input.submissionId, repositorySnapshot!),
        { commitSha: repositorySnapshot.commitSha }
      );

      const buildTestPromise = runTrackedActivity(
        'IsolatedBuildTestRuntimeActivity',
        () => EvaluationActivities.runBuildTestActivity(input.submissionId, repositorySnapshot!),
        { commitSha: repositorySnapshot.commitSha }
      );

      const frontendEvalPromise =
        projectType === 'BACKEND'
          ? Promise.resolve({
              tool: 'Playwright + Lighthouse + axe-core' as const,
              execution: notApplicableExecution(
                'Playwright + Lighthouse + axe-core',
                'The event is configured as a backend-only project.'
              )
            })
          : runTrackedActivity(
              'FrontendEvalActivity',
              () =>
                EvaluationActivities.runFrontendEvalActivity(input.submissionId, input.liveSiteUrl),
              { liveSiteUrl: input.liveSiteUrl }
            );

      const backendEvalPromise =
        projectType === 'FRONTEND'
          ? Promise.resolve({
              tool: 'Schemathesis' as const,
              execution: notApplicableExecution(
                'Schemathesis',
                'The event is configured as a frontend-only project.'
              )
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

      const [codeAnalysis, buildTest, frontendEval, backendEval] = await Promise.all([
        codeAnalysisPromise,
        buildTestPromise,
        frontendEvalPromise,
        backendEvalPromise
      ]);

      // Step 5: Assemble & Persist Evidence
      await ReviewSubmission.updateOne(
        { _id: input.submissionId, currentWorkflowId: workflowId },
        {
          status: 'EVIDENCE_COLLECTION'
        }
      );
      await runTrackedActivity('AssembleEvidenceActivity', () =>
        EvaluationActivities.assembleEvidenceActivity(
          input.submissionId,
          input.eventId,
          repositorySnapshot!,
          discovery,
          codeAnalysis,
          buildTest,
          frontendEval,
          backendEval
        )
      );

      // Step 6: Scoring Engine (Evidence-Grounded)
      await ReviewSubmission.updateOne(
        { _id: input.submissionId, currentWorkflowId: workflowId },
        { status: 'SCORING' }
      );
      const scoreResult = await runTrackedActivity(
        'EvidenceGroundedScoringActivity',
        () => EvaluationActivities.runScoringActivity(input.submissionId, input.eventId),
        { submissionId: input.submissionId, eventId: input.eventId }
      );

      overallScore = scoreResult.overallScore;
      if (scoreResult.evaluationStatus === 'PARTIAL' && !flaggedForHumanReview) {
        overallFinalStatus = 'PARTIAL';
      }

      // Final status update on submission
      await ReviewSubmission.updateOne(
        { _id: input.submissionId, currentWorkflowId: workflowId },
        {
          status: flaggedForHumanReview
            ? 'FLAGGED_FOR_REVIEW'
            : scoreResult.evaluationStatus === 'PARTIAL'
              ? 'PARTIAL'
              : 'EVALUATED'
        }
      );

      // Auto-recalibrate relative rankings and comparative insights for the event
      try {
        const { RankingService } = await import('../ranking/ranking.service.js');
        await RankingService.rankEvent(input.eventId);
      } catch (rankErr) {
        logger.warn(
          { rankErr, eventId: input.eventId },
          'Automatic post-evaluation relative ranking generation failed'
        );
      }
    } catch (err: unknown) {
      logger.error({ err, workflowId }, 'Evaluation workflow failed during activity execution');
      overallFinalStatus = 'FAILED';
      await ReviewSubmission.updateOne(
        { _id: input.submissionId, currentWorkflowId: workflowId },
        { status: 'FAILED' }
      );
      workflowError = err;
    } finally {
      if (repositorySnapshot) {
        try {
          await RepositoryRunner.cleanup(repositorySnapshot);
        } catch (cleanupError) {
          logger.error({ cleanupError, workflowId }, 'Failed to destroy evaluation workspace');
        }
      }
    }

    const totalDurationMs = Date.now() - workflowStart;

    // Step 6: Persist Replay Trace (§20 Evaluation Replay)
    await ReplayTrace.updateOne(
      { workflowId },
      { $set: { activities: activitiesTrace, finalStatus: overallFinalStatus, totalDurationMs } }
    );

    logger.info(
      { workflowId, finalStatus: overallFinalStatus, totalDurationMs },
      'Evaluation workflow completed and replay trace persisted'
    );

    if (workflowError) throw workflowError;

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
}

export default WorkflowRunner;
