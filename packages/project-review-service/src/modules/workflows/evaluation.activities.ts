import { Types } from 'mongoose';
import { ProjectDiscoveryRunner } from '../runners/discovery.runner.js';
import { CodeAnalysisRunner } from '../runners/code-analysis.runner.js';
import { FrontendEvalRunner } from '../runners/frontend.runner.js';
import { BackendEvalRunner } from '../runners/backend.runner.js';
import { SanitizationFacade } from '../sanitization/sanitization.facade.js';
import { ScoringEngine } from '../scoring/scoring.engine.js';
import { Evidence } from '../../models/Evidence.model.js';
import { ReviewEvent } from '../../models/Event.model.js';
import { SanitizationAudit } from '../../models/SanitizationAudit.model.js';
import { ReviewSubmission } from '../../models/Submission.model.js';
import { UntrustedInputSource } from '../sanitization/types.js';
import logger from '../../shared/config/logger.config.js';

export class EvaluationActivities {
  /**
   * Activity 1: Project Discovery
   */
  public static async runDiscoveryActivity(submissionId: string, repoUrl: string, branch = 'main') {
    logger.info({ submissionId, repoUrl, branch }, 'Activity: Discovery started');
    const discoveryResult = await ProjectDiscoveryRunner.discover(repoUrl, branch, submissionId);
    return discoveryResult;
  }

  /**
   * Activity 2: Content Sanitization & Prompt Injection Defense
   */
  public static async runSanitizationActivity(
    submissionId: string,
    eventId: string,
    rawReadme?: string,
    liveUrl?: string
  ) {
    logger.info({ submissionId }, 'Activity: Sanitization started');
    const inputs: UntrustedInputSource[] = [];

    if (rawReadme) {
      inputs.push({
        source: 'README',
        content: rawReadme,
        identifier: 'README.md'
      });
    }

    if (liveUrl) {
      inputs.push({
        source: 'LIVE_SITE',
        content: `Live site deployed at URL: ${liveUrl}`,
        identifier: 'live-url-meta'
      });
    }

    const sanitizationResult = await SanitizationFacade.sanitizeSubmission(
      new Types.ObjectId(submissionId),
      new Types.ObjectId(eventId),
      inputs
    );

    return sanitizationResult;
  }

  /**
   * Activity 3: Code & Security Analysis (Native SAST + Secrets + Syntax Audit)
   */
  public static async runCodeAnalysisActivity(
    submissionId: string,
    repoUrl: string,
    fileSnippets: Record<string, string> = {},
    fileList: string[] = []
  ) {
    logger.info({ submissionId, repoUrl }, 'Activity: Code & Security Analysis started');
    const codeAnalysisResult = await CodeAnalysisRunner.analyze(repoUrl, fileSnippets, fileList);
    return codeAnalysisResult;
  }

  /**
   * Activity 4: Frontend & Browser Evaluation (Playwright + Lighthouse + axe-core / Offline static audit)
   */
  public static async runFrontendEvalActivity(
    submissionId: string,
    liveSiteUrl?: string,
    fileSnippets: Record<string, string> = {},
    fileList: string[] = []
  ) {
    logger.info({ submissionId, liveSiteUrl }, 'Activity: Frontend & Browser Evaluation started');
    const frontendResult = await FrontendEvalRunner.evaluate(liveSiteUrl, fileSnippets, fileList);
    return frontendResult;
  }

  /**
   * Activity 5: Backend & API Evaluation (Schemathesis + k6 + OWASP ZAP)
   */
  public static async runBackendEvalActivity(
    submissionId: string,
    apiSpecUrl?: string,
    targetUrl?: string
  ) {
    logger.info({ submissionId }, 'Activity: Backend & API Evaluation started');
    const backendResult = await BackendEvalRunner.evaluate(apiSpecUrl, targetUrl);
    return backendResult;
  }

  /**
   * Activity 6: Evidence Bundle Assembly & Persistence
   */
  public static async assembleEvidenceActivity(
    submissionId: string,
    eventId: string,
    discovery: unknown,
    codeAnalysis: unknown,
    frontendEval: unknown,
    backendEval: unknown
  ) {
    logger.info({ submissionId }, 'Activity: Assembling and persisting evidence bundle');

    const evidenceDoc = await Evidence.findOneAndUpdate(
      { submissionId: new Types.ObjectId(submissionId) },
      {
        submissionId: new Types.ObjectId(submissionId),
        eventId: new Types.ObjectId(eventId),
        discovery,
        codeAnalysis,
        frontendEval,
        backendEval
      },
      { upsert: true, new: true }
    );

    return evidenceDoc;
  }

  /**
   * Activity 7: Evidence-Grounded Scoring (Instructor / Schema-enforced LLM evaluator)
   */
  public static async runScoringActivity(submissionId: string, eventId: string) {
    logger.info({ submissionId }, 'Activity: Evidence-Grounded Scoring started');

    const event = await ReviewEvent.findById(eventId);
    if (!event) throw new Error(`Event not found: ${eventId}`);

    const evidence = await Evidence.findOne({ submissionId });
    if (!evidence) throw new Error(`Evidence not found for submission: ${submissionId}`);

    const audit = await SanitizationAudit.findOne({ submissionId }).sort({ createdAt: -1 });
    const claims = {
      claimedFeatures: audit?.extractedClaims?.claimedFeatures || [],
      claimedEndpoints: audit?.extractedClaims?.claimedEndpoints || [],
      techStackClaims: audit?.extractedClaims?.techStackClaims || [],
      summary: audit?.extractedClaims?.summary || 'No textual claims available',
      secondarySafetyPassed: audit?.extractedClaims?.secondarySafetyPassed ?? true
    };

    const scoreResult = await ScoringEngine.evaluateSubmission(
      new Types.ObjectId(submissionId),
      new Types.ObjectId(eventId),
      event.criteria,
      event.requirements,
      evidence,
      claims,
      {
        name: event.name,
        description: event.description,
        problemStatement: event.problemStatement,
        projectType: event.projectType,
        requiresLiveUrl: event.requiresLiveUrl
      }
    );

    // Update submission status to evaluated
    await ReviewSubmission.findByIdAndUpdate(submissionId, { status: 'EVALUATED' });

    return scoreResult;
  }
}

export default EvaluationActivities;
