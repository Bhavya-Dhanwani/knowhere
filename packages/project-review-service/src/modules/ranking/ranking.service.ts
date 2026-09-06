import { Types } from 'mongoose';
import { PairwiseEngine } from './pairwise.engine.js';
import { SubmissionEvaluationPairInput } from './types.js';
import { ReviewEvaluation } from '../../models/Evaluation.model.js';
import { ReviewSubmission } from '../../models/Submission.model.js';
import { EventRanking, IEventRanking } from '../../models/Ranking.model.js';
import logger from '../../shared/config/logger.config.js';

export class RankingService {
  /**
   * Generates or updates the relative ranking for an event using pairwise Bradley-Terry estimation.
   */
  public static async rankEvent(eventId: string | Types.ObjectId): Promise<IEventRanking> {
    logger.info({ eventId }, 'Starting event relative ranking generation');

    // 1. Fetch all evaluated submissions for the event
    const evaluations = await ReviewEvaluation.find({ eventId }).lean();
    if (!evaluations || evaluations.length === 0) {
      throw new Error(`No evaluated submissions found for event ${eventId}`);
    }

    const subIds = evaluations.map((e) => e.submissionId);
    const submissions = await ReviewSubmission.find({ _id: { $in: subIds } }).lean();
    const subMap = new Map(submissions.map((s) => [s._id.toString(), s]));

    const { Evidence } = await import('../../models/Evidence.model.js');
    const evidences: any[] = await Evidence.find({ submissionId: { $in: subIds } }).lean();
    const evidenceMap = new Map(evidences.map((e: any) => [e.submissionId.toString(), e]));

    const { ReviewEvent } = await import('../../models/Event.model.js');
    const eventDoc = await ReviewEvent.findById(eventId).lean();
    const criteriaMap = new Map((eventDoc?.criteria || []).map((c) => [c.id, c]));

    // 2. Format inputs with criterion details, justifications, and evidence metrics
    const inputs: SubmissionEvaluationPairInput[] = evaluations.map((ev) => {
      const sub = subMap.get(ev.submissionId.toString());
      const evd = evidenceMap.get(ev.submissionId.toString());
      const criterionScores: Record<string, number> = {};
      const criterionDetails: Record<
        string,
        { name: string; weight: number; justification?: string }
      > = {};

      for (const cs of ev.criterionScores) {
        criterionScores[cs.criterionId] = cs.rawScore;
        const configCrit = criteriaMap.get(cs.criterionId);
        criterionDetails[cs.criterionId] = {
          name: cs.name || configCrit?.name || cs.criterionId,
          weight: configCrit?.weight || 0.2,
          justification: cs.justification
        };
      }

      const vulnerabilitiesCount =
        (evd?.codeAnalysis?.semgrep?.totalIssues || 0) +
        (evd?.codeAnalysis?.trivy?.vulnerabilityCount || 0) +
        (evd?.codeAnalysis?.gitleaks?.secretsFoundCount || 0);

      const requirementCountFulfilled = (ev.requirementCompliance || []).filter(
        (r) => r.status === 'FULFILLED'
      ).length;

      return {
        submissionId: ev.submissionId as Types.ObjectId,
        teamName: sub?.teamName || 'Unknown Team',
        overallScore: ev.overallScore,
        criterionScores,
        criterionDetails,
        vulnerabilitiesCount,
        requirementCountFulfilled,
        fileCount: evd?.discovery?.fileList?.length || 0,
        detectedFrameworks: evd?.discovery?.detectedFrameworks || [],
        submittedAt: sub?.createdAt
      };
    });

    // 3. Generate all pairwise combinations: N * (N - 1) / 2 matches
    const matches = [];
    for (let i = 0; i < inputs.length; i++) {
      for (let j = i + 1; j < inputs.length; j++) {
        const match = PairwiseEngine.compare(inputs[i], inputs[j]);
        matches.push(match);
      }
    }

    // 4. Compute Bradley-Terry ratings with collision-free sorting & relative analysis
    const ratings = PairwiseEngine.computeBradleyTerryRatings(inputs, matches);

    // 5. Assemble leaderboard with relative comparative insights, rank reasons & relative grading
    const leaderboard = ratings.map((r) => ({
      rank: r.rank,
      submissionId: r.submissionId,
      teamName: r.teamName,
      absoluteScore: r.absoluteScore,
      latentSkillScore: r.latentRating,
      winRate: r.winRate,
      confidenceInterval: [
        parseFloat(Math.max(0, r.latentRating - 5).toFixed(2)),
        parseFloat(Math.min(100, r.latentRating + 5).toFixed(2))
      ] as [number, number],
      discrepancyAnomalyFlag: r.discrepancyAnomaly,
      rankReason: r.rankReason,
      relativeGrading: r.relativeGrading,
      relativeAnalysis: r.relativeAnalysis
    }));

    // 6. Persist to MongoDB
    const rankingDoc = await EventRanking.findOneAndUpdate(
      { eventId },
      {
        eventId,
        algorithm: 'BRADLEY_TERRY_PAIRWISE',
        totalSubmissionsRanked: inputs.length,
        totalPairwiseMatches: matches.length,
        leaderboard,
        pairwiseMatrix: matches,
        generatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    logger.info(
      { eventId, totalRanked: inputs.length, totalMatches: matches.length },
      'Relative ranking and Bradley-Terry leaderboard successfully computed'
    );

    return rankingDoc;
  }
}

export default RankingService;
