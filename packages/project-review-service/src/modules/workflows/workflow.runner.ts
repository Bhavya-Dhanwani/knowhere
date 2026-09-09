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
import { EvaluationLogger } from '../logging/evaluation-logger.service.js';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';

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
    await ReviewSubmission.findByIdAndUpdate(input.submissionId, {
      status: 'DISCOVERING',
      currentWorkflowId: workflowId
    });

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

      const [codeAnalysis, frontendEval, backendEval] = await Promise.all([
        codeAnalysisPromise,
        frontendEvalPromise,
        backendEvalPromise
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
        { codeAnalysis, frontendEval, backendEval }
      );

      // Step 4: Assemble & Persist Evidence
      const assembledEvidence = await runTrackedActivity('AssembleEvidenceActivity', () =>
        EvaluationActivities.assembleEvidenceActivity(
          input.submissionId,
          input.eventId,
          discovery,
          codeAnalysis,
          frontendEval,
          backendEval
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
          { status: 'FAILED', error: rankErr instanceof Error ? rankErr.message : String(rankErr) }
        );
      }
    } catch (err: unknown) {
      logger.error({ err, workflowId }, 'Evaluation workflow failed during activity execution');
      overallFinalStatus = 'FAILED';
      await ReviewSubmission.findByIdAndUpdate(input.submissionId, { status: 'FAILED' });
    }

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
}

export default WorkflowRunner;
