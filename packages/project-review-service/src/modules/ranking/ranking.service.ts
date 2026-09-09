import { Types } from 'mongoose';
import { PairwiseEngine } from './pairwise.engine.js';
import { RankingBoundaryDetector } from './boundary-detector.js';
import { SubmissionEvaluationPairInput } from './types.js';
import {
  ENGINEERING_DIMENSIONS,
  DIMENSION_DISPLAY_NAMES,
  DEFAULT_DIMENSION_WEIGHTS,
  EngineeringDimension
} from '../scoring/types.js';
import { ReviewEvaluation } from '../../models/Evaluation.model.js';
import { ReviewSubmission } from '../../models/Submission.model.js';
import { EventRanking, IEventRanking } from '../../models/Ranking.model.js';
import logger from '../../shared/config/logger.config.js';

export class RankingService {
  /**
   * Generates or updates the RE:DESIGN relative ranking for an event using:
   * 1. Initial independent project ranking
   * 2. Critical ranking boundary detection (close neighbors)
   * 3. Targeted pairwise comparison across 9 dimensions
   * 4. Contradiction & anomaly checking
   * 5. "Why Am I #2?" explanation generator
   * 6. Comparison matrix generation
   */
  public static async rankEvent(eventId: string | Types.ObjectId): Promise<IEventRanking> {
    logger.info({ eventId }, 'Starting RE:DESIGN event relative ranking generation');

    // 1. Fetch all evaluated submissions for the event
    const evQuery: any = ReviewEvaluation.find({ eventId });
    const evaluations = typeof evQuery?.lean === 'function' ? await evQuery.lean() : await evQuery;
    if (!evaluations || evaluations.length === 0) {
      throw new Error(`No evaluated submissions found for event ${eventId}`);
    }

    const subIds = evaluations.map((e: any) => e.submissionId);
    const subQuery: any = ReviewSubmission.find({ _id: { $in: subIds } });
    const submissions =
      typeof subQuery?.lean === 'function' ? await subQuery.lean() : await subQuery;
    const subMap = new Map<string, any>((submissions || []).map((s: any) => [s._id.toString(), s]));

    const { Evidence } = await import('../../models/Evidence.model.js');
    const evdQuery: any = Evidence.find({ submissionId: { $in: subIds } });
    const evidences: any[] =
      typeof evdQuery?.lean === 'function' ? await evdQuery.lean() : await evdQuery;
    const evidenceMap = new Map<string, any>(
      (evidences || []).map((e: any) => [e.submissionId.toString(), e])
    );

    const { ReviewEvent } = await import('../../models/Event.model.js');
    const evtQuery: any = ReviewEvent.findById(eventId);
    const eventDoc = typeof evtQuery?.lean === 'function' ? await evtQuery.lean() : await evtQuery;
    const criteriaMap = new Map<string, any>((eventDoc?.criteria || []).map((c: any) => [c.id, c]));

    // 2. Format inputs with criterion details, justifications, and RE:DESIGN dimension scores
    const inputs: SubmissionEvaluationPairInput[] = evaluations.map((ev: any) => {
      const sub = subMap.get(ev.submissionId.toString());
      const evd = evidenceMap.get(ev.submissionId.toString());
      const criterionScores: Record<string, number> = {};
      const criterionDetails: Record<
        string,
        { name: string; weight: number; justification?: string }
      > = {};

      for (const cs of ev.criterionScores || []) {
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
        (r: any) => r.status === 'FULFILLED'
      ).length;

      // Compute canonical dimension-weighted score
      let dimWeightedScore = 0;
      let hasDimScores = false;
      if (ev.dimensionScores && Object.keys(ev.dimensionScores).length > 0) {
        for (const dim of ENGINEERING_DIMENSIONS) {
          const ds = ev.dimensionScores[dim]?.finalScore ?? ev.dimensionScores[dim]?.score;
          if (typeof ds === 'number') {
            dimWeightedScore += ds * DEFAULT_DIMENSION_WEIGHTS[dim];
            hasDimScores = true;
          }
        }
      }
      const canonicalScore = hasDimScores
        ? parseFloat(dimWeightedScore.toFixed(1))
        : ev.overallScore;

      if (hasDimScores && Math.abs(ev.overallScore - canonicalScore) > 0.3) {
        ReviewEvaluation.findByIdAndUpdate(ev._id, { overallScore: canonicalScore }).exec();
      }

      return {
        submissionId: ev.submissionId as Types.ObjectId,
        teamName: sub?.teamName || 'Unknown Team',
        overallScore: canonicalScore,
        criterionScores,
        criterionDetails,
        dimensionScores: ev.dimensionScores || {},
        highestImpactImprovements: ev.highestImpactImprovements || [],
        confidenceScore: ev.confidenceScore || 90,
        vulnerabilitiesCount,
        requirementCountFulfilled,
        fileCount: evd?.discovery?.fileList?.length || 0,
        detectedFrameworks: evd?.discovery?.detectedFrameworks || [],
        submittedAt: sub?.createdAt
      };
    });

    // 3. Initial Sorting by Independent Score (Initial Ranking)
    inputs.sort((a, b) => b.overallScore - a.overallScore);

    // 4. Identify Close Ranking Boundaries
    const boundaryPairs = RankingBoundaryDetector.detectCloseBoundaries(inputs, 5.0);
    const closeRankingBoundaries = boundaryPairs.map((bp) => ({
      subAId: bp.subA.submissionId.toString(),
      subBId: bp.subB.submissionId.toString(),
      subAName: bp.subA.teamName,
      subBName: bp.subB.teamName,
      scoreDelta: bp.scoreDelta,
      boundaryReason: bp.boundaryReason
    }));

    // 5. Generate Pairwise Comparisons
    // For small-to-mid cohorts (N <= 25), compute full pairwise matrix.
    // For large scale (N > 25), compute boundary pairs and adjacent neighbors to scale O(N).
    const matches = [];
    const computedMatches = new Set<string>();

    if (inputs.length <= 25) {
      for (let i = 0; i < inputs.length; i++) {
        for (let j = i + 1; j < inputs.length; j++) {
          const match = PairwiseEngine.compare(inputs[i], inputs[j]);
          matches.push(match);
        }
      }
    } else {
      for (const bp of boundaryPairs) {
        const key = `${bp.subA.submissionId.toString()}_${bp.subB.submissionId.toString()}`;
        if (!computedMatches.has(key)) {
          computedMatches.add(key);
          const match = PairwiseEngine.compare(bp.subA, bp.subB);
          matches.push(match);
        }
      }
    }

    // 6. Compute Bradley-Terry ratings with collision-free sorting & "Why Am I #2?" analysis
    const ratings = PairwiseEngine.computeBradleyTerryRatings(inputs, matches);

    // 7. Assemble Leaderboard Entries
    const leaderboard = ratings.map((r) => {
      const inputSub = inputs.find((i) => i.submissionId.toString() === r.submissionId.toString());
      return {
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
        whyAmIExplanation: r.whyAmIExplanation,
        dimensionScores: inputSub?.dimensionScores || {},
        relativeAnalysis: r.relativeAnalysis
      };
    });

    // 8. Generate 9-Dimension Comparison Matrix across all evaluated projects
    const comparisonMatrix = ENGINEERING_DIMENSIONS.map((dim) => {
      const scores: Record<string, number> = {};
      for (const item of inputs) {
        const dimScore =
          item.dimensionScores?.[dim]?.finalScore ??
          item.dimensionScores?.[dim]?.objectiveScore ??
          item.criterionScores[dim] ??
          item.overallScore;
        scores[item.submissionId.toString()] = parseFloat(dimScore.toFixed(1));
        scores[item.teamName] = parseFloat(dimScore.toFixed(1));
      }
      return {
        dimension: dim,
        dimensionName: DIMENSION_DISPLAY_NAMES[dim],
        scores
      };
    });

    // 9. Persist to EventRanking in MongoDB
    const rankingDoc = await EventRanking.findOneAndUpdate(
      { eventId },
      {
        eventId,
        algorithm: 'BRADLEY_TERRY_PAIRWISE',
        totalSubmissionsRanked: inputs.length,
        totalPairwiseMatches: matches.length,
        leaderboard,
        pairwiseMatrix: matches,
        closeRankingBoundaries,
        comparisonMatrix,
        generatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    logger.info(
      {
        eventId,
        totalRanked: inputs.length,
        totalMatches: matches.length,
        boundaryPairs: boundaryPairs.length
      },
      'RE:DESIGN relative ranking, boundary detection, and leaderboard successfully computed'
    );

    return rankingDoc;
  }
}

export default RankingService;
