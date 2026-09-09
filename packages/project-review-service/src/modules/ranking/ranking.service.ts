import { Types } from 'mongoose';
import { PairwiseEngine } from './pairwise.engine.js';
import { PairwiseComparisonResult, SubmissionEvaluationPairInput } from './types.js';
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
    const evaluations = await ReviewEvaluation.find({
      eventId,
      evaluationStatus: { $in: ['COMPLETE', 'PARTIAL'] }
    }).lean();
    if (!evaluations || evaluations.length === 0) {
      throw new Error(`No evaluated submissions found for event ${eventId}`);
    }

    const subIds = evaluations.map((e) => e.submissionId);
    const submissions = await ReviewSubmission.find({
      _id: { $in: subIds },
      status: { $in: ['EVALUATED', 'PARTIAL', 'FLAGGED_FOR_REVIEW'] }
    }).lean();
    const subMap = new Map(submissions.map((s) => [s._id.toString(), s]));

    const { Evidence } = await import('../../models/Evidence.model.js');
    const evidences: any[] = await Evidence.find({ submissionId: { $in: subIds } }).lean();
    const evidenceMap = new Map(evidences.map((e: any) => [e.submissionId.toString(), e]));

    const { ReviewEvent } = await import('../../models/Event.model.js');
    const eventDoc = await ReviewEvent.findById(eventId).lean();
    const criteriaMap = new Map((eventDoc?.criteria || []).map((c) => [c.id, c]));

    // 2. Format inputs with criterion details, justifications, and evidence metrics
    const inputs: SubmissionEvaluationPairInput[] = evaluations
      .filter((ev) => subMap.has(ev.submissionId.toString()))
      .map((ev) => {
        const sub = subMap.get(ev.submissionId.toString());
        const evd = evidenceMap.get(ev.submissionId.toString());
        const criterionScores: Record<string, number> = {};
        const criterionDetails: Record<
          string,
          { name: string; weight: number; confidence?: number; justification?: string }
        > = {};

        for (const cs of ev.criterionScores) {
          criterionScores[cs.criterionId] = cs.rawScore;
          const configCrit = criteriaMap.get(cs.criterionId);
          criterionDetails[cs.criterionId] = {
            name: cs.name || configCrit?.name || cs.criterionId,
            weight: configCrit?.weight ?? 0.2,
            confidence: cs.confidence,
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
          overallConfidence: ev.overallConfidence,
          evidenceCoverage: ev.evidenceCoverage,
          criterionScores,
          criterionDetails,
          vulnerabilitiesCount,
          requirementCountFulfilled,
          fileCount: evd?.discovery?.fileList?.length || 0,
          detectedFrameworks: evd?.discovery?.detectedFrameworks || [],
          submittedAt: sub?.createdAt
        };
      });
    if (inputs.length === 0) {
      await EventRanking.deleteOne({ eventId });
      throw new Error(`No eligible evaluated submissions found for event ${eventId}`);
    }

    // 3. Use a complete tournament for small cohorts and a connected, deterministic
    // sparse tournament for large cohorts to avoid O(n²) growth.
    const matches: PairwiseComparisonResult[] = [];
    const ordered = [...inputs].sort(
      (a, b) =>
        b.overallScore - a.overallScore ||
        a.submissionId.toString().localeCompare(b.submissionId.toString())
    );
    const pairKeys = new Set<string>();
    const addPair = (left: number, right: number) => {
      if (left < 0 || right >= ordered.length || left === right) return;
      const key = `${Math.min(left, right)}:${Math.max(left, right)}`;
      if (pairKeys.has(key)) return;
      pairKeys.add(key);
      matches.push(PairwiseEngine.compare(ordered[left], ordered[right]));
    };

    if (ordered.length <= 100) {
      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) addPair(i, j);
      }
    } else {
      for (let i = 0; i < ordered.length; i++) {
        for (let neighbor = 1; neighbor <= 5; neighbor++) addPair(i, i + neighbor);
        for (let offset = 8; offset < ordered.length; offset *= 2) addPair(i, i + offset);
      }
    }

    // 4. Compute Bradley-Terry ratings with collision-free sorting & relative analysis
    const ratings = PairwiseEngine.computeBradleyTerryRatings(inputs, matches);

    // 5. Assemble leaderboard with relative comparative insights, rank reasons & relative grading
    const comparisonsBySubmission = new Map<string, number>();
    for (const match of matches) {
      for (const id of [match.subA.toString(), match.subB.toString()]) {
        comparisonsBySubmission.set(id, (comparisonsBySubmission.get(id) || 0) + 1);
      }
    }
    const leaderboard = ratings.map((r) => {
      const comparisonCount = comparisonsBySubmission.get(r.submissionId.toString()) || 0;
      const standardError = Math.sqrt(
        Math.max(r.winRate * (1 - r.winRate), 0.05) / Math.max(comparisonCount, 1)
      );
      const intervalWidth = 100 * 1.96 * standardError;
      return {
        rank: r.rank,
        submissionId: r.submissionId,
        teamName: r.teamName,
        absoluteScore: r.absoluteScore,
        latentSkillScore: r.latentRating,
        winRate: r.winRate,
        confidenceInterval: [
          parseFloat(Math.max(0, r.latentRating - intervalWidth).toFixed(2)),
          parseFloat(Math.min(100, r.latentRating + intervalWidth).toFixed(2))
        ] as [number, number],
        discrepancyAnomalyFlag: r.discrepancyAnomaly,
        rankReason: r.rankReason,
        relativeGrading: r.relativeGrading,
        relativeAnalysis: r.relativeAnalysis
      };
    });

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
