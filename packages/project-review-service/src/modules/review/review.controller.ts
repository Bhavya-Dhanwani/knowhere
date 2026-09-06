import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { ReviewEvent } from '../../models/Event.model.js';
import { ReviewSubmission } from '../../models/Submission.model.js';
import { SanitizationAudit } from '../../models/SanitizationAudit.model.js';
import { Evidence } from '../../models/Evidence.model.js';
import { ReviewEvaluation } from '../../models/Evaluation.model.js';
import { EventRanking } from '../../models/Ranking.model.js';
import { ReplayTrace } from '../../models/ReplayTrace.model.js';
import { WorkflowRunner } from '../workflows/workflow.runner.js';
import { RankingService } from '../ranking/ranking.service.js';
import { NotFound, BadRequest } from '../../shared/errors/index.js';
import HTTP_STATUS from '../../shared/constants/StatusCodes.constants.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import logger from '../../shared/config/logger.config.js';

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

  public async getLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getId(req);
      const ranking = await EventRanking.findOne({ eventId: id });
      if (!ranking)
        throw new NotFound(`Leaderboard not found for event: ${id}. Run compute ranking first.`);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          eventId: ranking.eventId,
          algorithm: ranking.algorithm,
          totalSubmissionsRanked: ranking.totalSubmissionsRanked,
          leaderboard: ranking.leaderboard,
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
          pairwiseMatrix: ranking.pairwiseMatrix
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
      const { newScore, reason } = req.body;

      const evaluation = await ReviewEvaluation.findOne({ submissionId: id });
      if (!evaluation) throw new NotFound(`Evaluation not found for submission: ${id}`);

      const originalScore = evaluation.overallScore;

      evaluation.judgeOverride = {
        overridden: true,
        judgeId: req.user?.userId || 'manual-judge',
        originalScore,
        newScore,
        reason,
        overriddenAt: new Date()
      };
      evaluation.overallScore = newScore;
      await evaluation.save();

      logger.info(
        { submissionId: id, originalScore, newScore, judgeId: req.user?.userId },
        'Judge override applied to evaluation score'
      );

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Judge score override applied successfully',
        data: evaluation
      });
    } catch (error) {
      next(error);
    }
  }
}

export default ReviewController;
