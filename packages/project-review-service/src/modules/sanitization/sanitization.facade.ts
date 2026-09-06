import { Types } from 'mongoose';
import { UntrustedInputSource, SanitizationResult } from './types.js';
import DelimiterService from './delimiter.service.js';
import InjectionDetectorService from './injection-detector.service.js';
import ExtractionService from './extraction.service.js';
import MistralExtractionAgent from '../ai/extraction.agent.js';
import { SanitizationAudit } from '../../models/SanitizationAudit.model.js';
import { ReviewSubmission } from '../../models/Submission.model.js';
import logger from '../../shared/config/logger.config.js';

export class SanitizationFacade {
  /**
   * Executes the full Content Sanitization & Injection Defense stage:
   * 1. Delimiter isolation
   * 2. Injection pattern detection & anomaly scanning
   * 3. Low-privilege extraction pass (ChatMistralAI)
   * 4. Audit logging & submission status update
   */
  public static async sanitizeSubmission(
    submissionId: string | Types.ObjectId,
    eventId: string | Types.ObjectId,
    inputs: UntrustedInputSource[]
  ): Promise<SanitizationResult> {
    logger.info({ submissionId }, 'Starting Content Sanitization & Injection Defense stage');

    // 1. Delimiter Isolation
    const { delimitedText } = DelimiterService.isolateContent(inputs);

    // 2. Injection Pattern Scanning
    const detectionResult = InjectionDetectorService.scan(inputs);

    // 3. Low-Privilege Extraction Pass (using ChatMistralAI with Round-Robin key pool)
    const extractedClaims = await MistralExtractionAgent.extract(delimitedText);

    // 4. Anomaly Decision
    let humanReviewRequired = detectionResult.flaggedForHumanReview;
    let anomalyReason = detectionResult.reason;

    if (!extractedClaims.secondarySafetyPassed) {
      humanReviewRequired = true;
      anomalyReason = anomalyReason
        ? `${anomalyReason}; Secondary extraction safety failed (instruction bleed)`
        : 'Secondary extraction safety check failed: instruction tokens detected in neutral claims';
    }

    const sanitizationPassed = !humanReviewRequired;

    // 5. Persist Sanitization Audit Record
    const auditRecord = await SanitizationAudit.create({
      submissionId,
      eventId,
      rawInputExcerptsCount: inputs.length,
      delimitedContext: delimitedText,
      extractedClaims,
      injectionMarkersFound: detectionResult.markers,
      flaggedAnomaly: humanReviewRequired,
      anomalyReason,
      humanReviewRequired,
      sanitizationPassed
    });

    // 6. Update Submission status
    if (humanReviewRequired) {
      await ReviewSubmission.findByIdAndUpdate(submissionId, {
        status: 'FLAGGED_FOR_REVIEW',
        flaggedForHumanReview: true,
        flagReason: anomalyReason
      });
      logger.warn(
        { submissionId, anomalyReason },
        'Submission flagged for mandatory human review due to prompt injection anomaly'
      );
    }

    return {
      delimitedContext: delimitedText,
      extractedClaims,
      detectionResult,
      humanReviewRequired,
      sanitizationPassed
    };
  }
}

export default SanitizationFacade;
