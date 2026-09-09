import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { ReviewEvent } from '../../models/Event.model.js';
import { ReviewSubmission } from '../../models/Submission.model.js';
import { SanitizationAudit } from '../../models/SanitizationAudit.model.js';
import { Evidence } from '../../models/Evidence.model.js';
import { ReviewEvaluation } from '../../models/Evaluation.model.js';
import { EventRanking, IEventRanking } from '../../models/Ranking.model.js';
import { ReplayTrace } from '../../models/ReplayTrace.model.js';
import { WorkflowRunner } from '../workflows/workflow.runner.js';
import { RankingService } from '../ranking/ranking.service.js';
import { ENGINEERING_DIMENSIONS, DEFAULT_DIMENSION_WEIGHTS } from '../scoring/types.js';
import { NotFound, BadRequest } from '../../shared/errors/index.js';
import HTTP_STATUS from '../../shared/constants/StatusCodes.constants.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import logger from '../../shared/config/logger.config.js';
import { exportService } from '../export/export.service.js';

const getId = (req: Request): string =>
  (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

export class ReviewController {
  // ==================== EVENTS ====================

  public async createEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        name,
        description,
        problemStatement,
        projectType,
        criteria,
        requirements,
        strictScoring,
        requiresLiveUrl,
        requiresApiSpec
      } = req.body;

      // Validate total weight sums to 1.0 (or close within float tolerance)
      const totalWeight = criteria.reduce(
        (sum: number, c: { weight: number }) => sum + (Number(c.weight) || 0),
        0
      );
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        throw new BadRequest(
          `Sum of criteria weights must equal 1.0, current sum: ${totalWeight.toFixed(2)}`
        );
      }

      const event = await ReviewEvent.create({
        name,
        description,
        problemStatement,
        projectType: projectType || 'FULLSTACK',
        requiresLiveUrl: !!requiresLiveUrl,
        requiresApiSpec: !!requiresApiSpec,
        criteria,
        requirements: requirements || [],
        strictScoring: strictScoring !== undefined ? strictScoring : true
      });

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Review event created successfully',
        data: event
      });
    } catch (error) {
      next(error);
    }
  }

  public async getEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const event = await ReviewEvent.findById(id);
      if (!event) throw new NotFound(`Review event not found: ${id}`);

      return res.status(HTTP_STATUS.OK).json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  }

  public async updateEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const {
        name,
        description,
        problemStatement,
        projectType,
        criteria,
        requirements,
        strictScoring,
        requiresLiveUrl,
        requiresApiSpec,
        status
      } = req.body;

      if (criteria && Array.isArray(criteria)) {
        const totalWeight = criteria.reduce(
          (sum: number, c: { weight: number }) => sum + (Number(c.weight) || 0),
          0
        );
        if (Math.abs(totalWeight - 1.0) > 0.01) {
          throw new BadRequest(
            `Sum of criteria weights must equal 1.0, current sum: ${totalWeight.toFixed(2)}`
          );
        }
      }

      const event = await ReviewEvent.findByIdAndUpdate(
        id,
        {
          ...(name && { name }),
          ...(description && { description }),
          ...(problemStatement && { problemStatement }),
          ...(projectType && { projectType }),
          ...(criteria && { criteria }),
          ...(requirements && { requirements }),
          ...(strictScoring !== undefined && { strictScoring }),
          ...(requiresLiveUrl !== undefined && { requiresLiveUrl }),
          ...(requiresApiSpec !== undefined && { requiresApiSpec }),
          ...(status && { status })
        },
        { new: true, runValidators: true }
      );
      if (!event) throw new NotFound(`Review event not found: ${id}`);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Review event updated successfully',
        data: event
      });
    } catch (error) {
      next(error);
    }
  }

  public async listEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await ReviewEvent.find().sort({ createdAt: -1 });
      return res.status(HTTP_STATUS.OK).json({ success: true, count: events.length, data: events });
    } catch (error) {
      next(error);
    }
  }

  // ==================== SUBMISSIONS ====================

  public async submitProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const eventId = getId(req);
      const event = await ReviewEvent.findById(eventId);
      if (!event) throw new NotFound(`Event not found: ${eventId}`);

      const { teamName, teamId, repositoryUrl, branch, liveSiteUrl, apiSpecUrl, rawReadmeText } =
        req.body;

      const submission = await ReviewSubmission.create({
        eventId: new Types.ObjectId(eventId),
        teamName,
        teamId,
        author: {
          userId: req.user?.userId || 'anonymous-author',
          name: req.user?.name,
          email: req.user?.email
        },
        repositoryUrl,
        branch: branch || 'main',
        liveSiteUrl,
        apiSpecUrl,
        rawReadmeText,
        status: 'SUBMITTED'
      });

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Project submitted successfully for review',
        data: submission
      });
    } catch (error) {
      next(error);
    }
  }

  public async getSubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const submission = await ReviewSubmission.findById(id);
      if (!submission) throw new NotFound(`Submission not found: ${id}`);

      return res.status(HTTP_STATUS.OK).json({ success: true, data: submission });
    } catch (error) {
      next(error);
    }
  }

  public async listSubmissionsForEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const submissions = await ReviewSubmission.find({ eventId: id }).sort({ createdAt: -1 });
      return res
        .status(HTTP_STATUS.OK)
        .json({ success: true, count: submissions.length, data: submissions });
    } catch (error) {
      next(error);
    }
  }

  public async deleteSubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const submission = await ReviewSubmission.findByIdAndDelete(id);
      if (!submission) throw new NotFound(`Submission not found: ${id}`);

      await Promise.all([
        Evidence.deleteMany({ submissionId: id }),
        ReviewEvaluation.deleteMany({ submissionId: id }),
        ReplayTrace.deleteMany({ submissionId: id }),
        SanitizationAudit.deleteMany({ submissionId: id })
      ]);

      return res
        .status(HTTP_STATUS.OK)
        .json({ success: true, message: 'Submission deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  public async updateSubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const { teamName, teamId, repositoryUrl, branch, liveSiteUrl, apiSpecUrl, rawReadmeText } =
        req.body;

      const submission = await ReviewSubmission.findByIdAndUpdate(
        id,
        {
          ...(teamName && { teamName: teamName.trim() }),
          ...(teamId && { teamId: teamId.trim() }),
          ...(repositoryUrl && { repositoryUrl: repositoryUrl.trim() }),
          ...(branch !== undefined && { branch: branch.trim() || 'main' }),
          ...(liveSiteUrl !== undefined && { liveSiteUrl: liveSiteUrl.trim() }),
          ...(apiSpecUrl !== undefined && { apiSpecUrl: apiSpecUrl.trim() }),
          ...(rawReadmeText !== undefined && { rawReadmeText: rawReadmeText.trim() })
        },
        { new: true, runValidators: true }
      );
      if (!submission) throw new NotFound(`Submission not found: ${id}`);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Submission updated successfully',
        data: submission
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== EVALUATION & WORKFLOWS ====================

  public async evaluateSubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const submission = await ReviewSubmission.findById(id);
      if (!submission) throw new NotFound(`Submission not found: ${id}`);

      const event = await ReviewEvent.findById(submission.eventId);
      if (!event) throw new NotFound(`Associated event not found: ${submission.eventId}`);

      // Dispatch durable evaluation workflow
      const result = await WorkflowRunner.executeEvaluation({
        submissionId: submission._id.toString(),
        eventId: event._id.toString(),
        repoUrl: submission.repositoryUrl,
        branch: submission.branch,
        liveSiteUrl: submission.liveSiteUrl,
        apiSpecUrl: submission.apiSpecUrl,
        rawReadme: submission.rawReadmeText
      });

      return res.status(HTTP_STATUS.ACCEPTED).json({
        success: true,
        message: 'Evaluation workflow executed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public async getEvaluationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const submission = await ReviewSubmission.findById(id).select(
        'status flaggedForHumanReview flagReason currentWorkflowId updatedAt'
      );
      if (!submission) throw new NotFound(`Submission not found: ${id}`);

      return res.status(HTTP_STATUS.OK).json({ success: true, data: submission });
    } catch (error) {
      next(error);
    }
  }

  // ==================== SANITIZATION & AUDIT ====================

  public async getSanitizationAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const audit = await SanitizationAudit.findOne({ submissionId: id }).sort({ createdAt: -1 });
      if (!audit) throw new NotFound(`Sanitization audit not found for submission: ${id}`);

      return res.status(HTTP_STATUS.OK).json({ success: true, data: audit });
    } catch (error) {
      next(error);
    }
  }

  // ==================== REPORTS & EVIDENCE ====================

  public async getEvaluationReport(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const submission = await ReviewSubmission.findById(id);
      if (!submission) throw new NotFound(`Submission not found: ${id}`);

      const evaluation = await ReviewEvaluation.findOne({ submissionId: id });
      const evidence = await Evidence.findOne({ submissionId: id });
      const sanitization = await SanitizationAudit.findOne({ submissionId: id });

      const { EventRanking } = await import('../../models/Ranking.model.js');
      const rankingDoc = await EventRanking.findOne({ eventId: submission.eventId }).lean();
      const rankingEntry = rankingDoc?.leaderboard?.find(
        (entry) => entry.submissionId.toString() === id.toString()
      );

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          submission,
          evaluation,
          evidence,
          sanitizationAudit: sanitization,
          ranking: rankingEntry
            ? {
                rank: rankingEntry.rank,
                totalSubmissionsRanked:
                  rankingDoc?.totalSubmissionsRanked || rankingDoc?.leaderboard?.length || 1,
                latentSkillScore: rankingEntry.latentSkillScore,
                winRate: rankingEntry.winRate,
                confidenceInterval: rankingEntry.confidenceInterval,
                rankReason: rankingEntry.rankReason,
                relativeGrading: rankingEntry.relativeGrading,
                relativeAnalysis: rankingEntry.relativeAnalysis
              }
            : null
        }
      });
    } catch (error) {
      next(error);
    }
  }

  public async exportReportPdfMetadata(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const submission = await ReviewSubmission.findById(id);
      if (!submission) throw new NotFound(`Submission not found: ${id}`);

      const evaluation = await ReviewEvaluation.findOne({ submissionId: id });

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Report ready for Playwright print-to-pdf generation',
        exportUrl: `/api/review/submissions/${id}/report`,
        metadata: {
          submissionId: submission._id,
          teamName: submission.teamName,
          overallScore: evaluation?.overallScore ?? 0,
          exportDate: new Date()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== EVALUATION REPLAY (§20) ====================

  public async getEvaluationReplay(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const trace = await ReplayTrace.findOne({ submissionId: id }).sort({ createdAt: -1 });
      if (!trace) throw new NotFound(`Replay trace not found for submission: ${id}`);

      return res.status(HTTP_STATUS.OK).json({ success: true, data: trace });
    } catch (error) {
      next(error);
    }
  }

  // ==================== RANKING & PAIRWISE ====================

  public async computeEventRanking(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const ranking = await RankingService.rankEvent(id);
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Relative ranking calculated successfully',
        data: ranking
      });
    } catch (error) {
      next(error);
    }
  }

  private static isRankingRecalibrationNeeded(ranking: IEventRanking): boolean {
    if (!ranking.leaderboard || ranking.leaderboard.length === 0) return true;
    for (const entry of ranking.leaderboard) {
      const dims = entry.dimensionScores || {};
      // If legacy document without dimensionScores on entry, must recalibrate
      if (Object.keys(dims).length === 0) return true;
      let sum = 0;
      for (const dim of ENGINEERING_DIMENSIONS) {
        const d = dims[dim];
        const sc = (d as any)?.finalScore ?? (d as any)?.score;
        const wt = (d as any)?.weight ?? DEFAULT_DIMENSION_WEIGHTS[dim] ?? 0.1;
        if (typeof sc === 'number') sum += sc * wt;
      }
      if (Math.abs(sum - entry.absoluteScore) > 0.5) return true;
    }

    if (ranking.comparisonMatrix && ranking.comparisonMatrix.length > 0) {
      for (const entry of ranking.leaderboard) {
        let compSum = 0;
        let count = 0;
        for (const row of ranking.comparisonMatrix) {
          const sc = row.scores?.[entry.teamName] ?? row.scores?.[entry.submissionId.toString()];
          const wt = (DEFAULT_DIMENSION_WEIGHTS as Record<string, number>)[row.dimension] ?? 0.1;
          if (typeof sc === 'number') {
            compSum += sc * wt;
            count++;
          }
        }
        if (count >= 5 && Math.abs(compSum - entry.absoluteScore) > 1.0) {
          return true;
        }
      }
    }
    return false;
  }

  public async getLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      let ranking: IEventRanking | null = await EventRanking.findOne({ eventId: id });
      if (!ranking || ReviewController.isRankingRecalibrationNeeded(ranking)) {
        ranking = await RankingService.rankEvent(id);
      }
      if (!ranking) throw new NotFound(`Leaderboard not found for event: ${id}`);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          eventId: ranking.eventId,
          algorithm: ranking.algorithm,
          totalSubmissionsRanked: ranking.totalSubmissionsRanked,
          leaderboard: ranking.leaderboard,
          closeRankingBoundaries: ranking.closeRankingBoundaries,
          comparisonMatrix: ranking.comparisonMatrix,
          generatedAt: ranking.generatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  public async getPairwiseMatrix(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const ranking = await EventRanking.findOne({ eventId: id });
      if (!ranking) throw new NotFound(`Pairwise matrix not found for event: ${id}`);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          eventId: ranking.eventId,
          totalPairwiseMatches: ranking.totalPairwiseMatches,
          pairwiseMatrix: ranking.pairwiseMatrix,
          closeRankingBoundaries: ranking.closeRankingBoundaries
        }
      });
    } catch (error) {
      next(error);
    }
  }

  public async getComparisonMatrix(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      let ranking: IEventRanking | null = await EventRanking.findOne({ eventId: id });
      if (!ranking || ReviewController.isRankingRecalibrationNeeded(ranking)) {
        ranking = await RankingService.rankEvent(id);
      }
      if (!ranking) throw new NotFound(`Comparison matrix not found for event: ${id}`);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          eventId: ranking.eventId,
          totalSubmissionsRanked: ranking.totalSubmissionsRanked,
          comparisonMatrix: ranking.comparisonMatrix,
          closeRankingBoundaries: ranking.closeRankingBoundaries
        }
      });
    } catch (error) {
      next(error);
    }
  }

  public async getEvidenceExplorer(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const evaluation = await ReviewEvaluation.findOne({ submissionId: id }).lean();
      if (!evaluation) throw new NotFound(`Evaluation not found for submission: ${id}`);

      const { Evidence } = await import('../../models/Evidence.model.js');
      const evidence = await Evidence.findOne({ submissionId: id }).lean();

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          submissionId: id,
          overallScore: evaluation.overallScore,
          objectiveScore: evaluation.objectiveScore,
          qualitativeScore: evaluation.qualitativeScore,
          confidenceScore: evaluation.confidenceScore,
          dimensionScores: evaluation.dimensionScores,
          engineeringEvidence: evaluation.engineeringEvidence,
          highestImpactImprovements: evaluation.highestImpactImprovements,
          reproducibility: evaluation.reproducibility,
          discoverySummary: evidence?.discovery,
          deterministicMetrics: evidence?.codeAnalysis?.deterministicMetrics
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== JUDGE OVERRIDE ====================

  public async judgeOverrideScore(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const { newScore, reason, action = 'MODIFY' } = req.body;

      const evaluation = await ReviewEvaluation.findOne({ submissionId: id });
      if (!evaluation) throw new NotFound(`Evaluation not found for submission: ${id}`);

      const originalScore = evaluation.overallScore;

      if (action === 'FLAG_FOR_REVIEW') {
        await ReviewSubmission.findByIdAndUpdate(id, {
          flaggedForHumanReview: true,
          flagReason: reason || 'Flagged by judge for deeper review'
        });
      } else if (action === 'ACCEPT') {
        evaluation.judgeOverride = {
          overridden: false,
          judgeId: req.user?.userId || 'manual-judge',
          reason: reason || 'Score accepted by judge',
          overriddenAt: new Date()
        };
        await evaluation.save();
      } else {
        // MODIFY score
        evaluation.judgeOverride = {
          overridden: true,
          judgeId: req.user?.userId || 'manual-judge',
          originalScore,
          newScore: typeof newScore === 'number' ? newScore : originalScore,
          reason,
          overriddenAt: new Date()
        };
        if (typeof newScore === 'number') {
          evaluation.overallScore = newScore;
        }
        await evaluation.save();
      }

      logger.info(
        { submissionId: id, originalScore, newScore, action, judgeId: req.user?.userId },
        'Judge action processed on evaluation'
      );

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Judge action ${action} processed successfully`,
        data: evaluation
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CSV & NOTION EXPORT ====================

  public async exportEventCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const csv = await exportService.generateEventCsv(id);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="event-${id}-report.csv"`);
      return res.status(HTTP_STATUS.OK).send(csv);
    } catch (error) {
      next(error);
    }
  }

  public async exportSubmissionCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const csv = await exportService.generateSubmissionCsv(id);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="submission-${id}-report.csv"`);
      return res.status(HTTP_STATUS.OK).send(csv);
    } catch (error) {
      next(error);
    }
  }

  public async exportEventNotion(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const format = req.query.format;
      const result = await exportService.generateEventNotionMarkdown(id);
      if (format === 'download' || format === 'file') {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="event-${id}-notion.md"`);
        return res.status(HTTP_STATUS.OK).send(result.markdown);
      }
      return res.status(HTTP_STATUS.OK).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  public async exportSubmissionNotion(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const format = req.query.format;
      const result = await exportService.generateSubmissionNotionMarkdown(id);
      if (format === 'download' || format === 'file') {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="submission-${id}-notion.md"`);
        return res.status(HTTP_STATUS.OK).send(result.markdown);
      }
      return res.status(HTTP_STATUS.OK).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  public async pushEventToNotion(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const { apiKey, parentPageId } = req.body || {};
      const report = await exportService.generateEventNotionMarkdown(id);
      const result = await exportService.pushToNotion({
        apiKey,
        parentPageId,
        title: report.title,
        markdownContent: report.markdown
      });
      if (!result.success) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(result);
      }
      return res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async pushSubmissionToNotion(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const { apiKey, parentPageId } = req.body || {};
      const report = await exportService.generateSubmissionNotionMarkdown(id);
      const result = await exportService.pushToNotion({
        apiKey,
        parentPageId,
        title: report.title,
        markdownContent: report.markdown
      });
      if (!result.success) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(result);
      }
      return res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export default ReviewController;
