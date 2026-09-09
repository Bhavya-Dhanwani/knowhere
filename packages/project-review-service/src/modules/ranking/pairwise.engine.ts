import {
  BradleyTerryRating,
  PairwiseComparisonResult,
  SubmissionEvaluationPairInput
} from './types.js';
import type { IRelativeComparison, IRelativeGrading } from '../../models/Ranking.model.js';

const round = (value: number, digits = 2): number => Number(value.toFixed(digits));

export class PairwiseEngine {
  public static compare(
    a: SubmissionEvaluationPairInput,
    b: SubmissionEvaluationPairInput
  ): PairwiseComparisonResult {
    const criterionIds = Array.from(
      new Set([...Object.keys(a.criterionScores), ...Object.keys(b.criterionScores)])
    ).sort();
    const criterionWins: Record<string, string> = {};
    let aWins = 0;
    let bWins = 0;
    let weightedDelta = 0;
    let usableWeight = 0;
    const hasConfiguredWeights = Boolean(a.criterionDetails || b.criterionDetails);

    for (const criterionId of criterionIds) {
      const scoreA = a.criterionScores[criterionId];
      const scoreB = b.criterionScores[criterionId];
      if (scoreA === undefined || scoreB === undefined) {
        criterionWins[criterionId] = 'TIE';
        continue;
      }
      if (scoreA > scoreB) {
        aWins++;
        criterionWins[criterionId] = a.submissionId.toString();
      } else if (scoreB > scoreA) {
        bWins++;
        criterionWins[criterionId] = b.submissionId.toString();
      } else {
        criterionWins[criterionId] = 'TIE';
      }

      const detailsA = a.criterionDetails?.[criterionId];
      const detailsB = b.criterionDetails?.[criterionId];
      const weight = detailsA?.weight ?? detailsB?.weight ?? 1;
      const sharedConfidence = Math.min(detailsA?.confidence ?? 1, detailsB?.confidence ?? 1);
      const effectiveWeight = weight * sharedConfidence;
      if (effectiveWeight > 0) {
        weightedDelta += (scoreA - scoreB) * effectiveWeight;
        usableWeight += effectiveWeight;
      }
    }

    if (!hasConfiguredWeights) {
      const countDelta = aWins - bWins;
      if (countDelta > 0) {
        return {
          subA: a.submissionId,
          subB: b.submissionId,
          winner: a.submissionId,
          criterionWins,
          margin: countDelta,
          rationale: `${a.teamName} outperformed ${b.teamName} on ${aWins}/${criterionIds.length} criteria.`
        };
      }
      if (countDelta < 0) {
        return {
          subA: a.submissionId,
          subB: b.submissionId,
          winner: b.submissionId,
          criterionWins,
          margin: Math.abs(countDelta),
          rationale: `${b.teamName} outperformed ${a.teamName} on ${bWins}/${criterionIds.length} criteria.`
        };
      }
    }

    const normalizedDelta = usableWeight > 0 ? weightedDelta / usableWeight : 0;
    const winner =
      normalizedDelta > 0.005 ? a.submissionId : normalizedDelta < -0.005 ? b.submissionId : 'TIE';
    const rationale =
      winner === 'TIE'
        ? `The submissions are tied across comparable, confidence-weighted rubric evidence.`
        : `${winner.equals(a.submissionId) ? a.teamName : b.teamName} leads by ${round(Math.abs(normalizedDelta))} confidence-weighted rubric points.`;

    return {
      subA: a.submissionId,
      subB: b.submissionId,
      winner,
      criterionWins,
      margin: round(Math.abs(normalizedDelta)),
      rationale,
      tieBreakApplied: false
    };
  }

  public static computeBradleyTerryRatings(
    submissions: SubmissionEvaluationPairInput[],
    matches: PairwiseComparisonResult[],
    maxIterations = 100,
    tolerance = 1e-4
  ): BradleyTerryRating[] {
    if (submissions.length === 0) return [];
    if (submissions.length === 1) {
      const only = submissions[0];
      return [
        {
          submissionId: only.submissionId,
          teamName: only.teamName,
          absoluteScore: only.overallScore,
          latentRating: only.overallScore,
          winRate: 1,
          rank: 1,
          rankReason: 'Only evaluated submission in the cohort.',
          discrepancyAnomaly: false,
          relativeGrading: this.relativeGrade(only, submissions),
          relativeAnalysis: { comparedToAbove: null, comparedToBelow: null }
        }
      ];
    }

    const indexById = new Map(
      submissions.map((submission, index) => [submission.submissionId.toString(), index])
    );
    const wins = Array(submissions.length).fill(0) as number[];
    const games = Array(submissions.length).fill(0) as number[];
    const comparisonsByOpponent = Array.from(
      { length: submissions.length },
      () => new Map<number, number>()
    );

    for (const match of matches) {
      const a = indexById.get(match.subA.toString());
      const b = indexById.get(match.subB.toString());
      if (a === undefined || b === undefined) continue;
      games[a]++;
      games[b]++;
      comparisonsByOpponent[a].set(b, (comparisonsByOpponent[a].get(b) || 0) + 1);
      comparisonsByOpponent[b].set(a, (comparisonsByOpponent[b].get(a) || 0) + 1);
      if (match.winner === 'TIE') {
        wins[a] += 0.5;
        wins[b] += 0.5;
      } else if (match.winner.toString() === match.subA.toString()) {
        wins[a]++;
      } else {
        wins[b]++;
      }
    }

    let abilities = Array(submissions.length).fill(1) as number[];
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const next = abilities.map((_, i) => {
        let denominator = 0;
        for (const [j, comparisons] of comparisonsByOpponent[i]) {
          denominator += comparisons / (abilities[i] + abilities[j]);
        }
        return (wins[i] + 0.5) / Math.max(denominator + 0.5, 0.5);
      });
      const mean = next.reduce((sum, value) => sum + value, 0) / next.length;
      const normalized = next.map((value) => value / Math.max(mean, Number.EPSILON));
      const change = normalized.reduce(
        (sum, value, index) => sum + Math.abs(value - abilities[index]),
        0
      );
      abilities = normalized;
      if (change < tolerance) break;
    }

    const min = Math.min(...abilities);
    const max = Math.max(...abilities);
    const range = Math.max(max - min, Number.EPSILON);
    const candidates = submissions.map((submission, index) => ({
      submission,
      ability: abilities[index],
      latent: round(50 + ((abilities[index] - min) / range) * 50),
      winRate: games[index] > 0 ? round(wins[index] / games[index], 3) : 0.5
    }));

    candidates.sort((left, right) => {
      const abilityDifference = right.ability - left.ability;
      if (Math.abs(abilityDifference) > tolerance) return abilityDifference;
      const scoreDifference = right.submission.overallScore - left.submission.overallScore;
      if (Math.abs(scoreDifference) > 0.005) return scoreDifference;
      return left.submission.submissionId
        .toString()
        .localeCompare(right.submission.submissionId.toString());
    });

    const results: BradleyTerryRating[] = [];
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      const previous = candidates[index - 1];
      const tiedWithPrevious = Boolean(
        previous &&
        Math.abs(candidate.ability - previous.ability) <= tolerance &&
        Math.abs(candidate.submission.overallScore - previous.submission.overallScore) <= 0.005
      );
      const rank = tiedWithPrevious ? results[index - 1].rank : index + 1;
      results.push({
        submissionId: candidate.submission.submissionId,
        teamName: candidate.submission.teamName,
        absoluteScore: candidate.submission.overallScore,
        latentRating: candidate.latent,
        winRate: candidate.winRate,
        rank,
        rankReason: tiedWithPrevious
          ? `Shared rank ${rank}: statistically tied on comparative rating and absolute score.`
          : `Rank ${rank}: comparative rating ${candidate.latent}, absolute score ${candidate.submission.overallScore}, and ${games[indexById.get(candidate.submission.submissionId.toString())!]} comparisons.`,
        relativeGrading: this.relativeGrade(candidate.submission, submissions),
        discrepancyAnomaly: false,
        relativeAnalysis: {
          comparedToAbove:
            index > 0
              ? this.compareForDisplay(
                  candidate.submission,
                  rank,
                  candidates[index - 1].submission,
                  results[index - 1].rank
                )
              : null,
          comparedToBelow:
            index < candidates.length - 1
              ? this.compareForDisplay(
                  candidate.submission,
                  rank,
                  candidates[index + 1].submission,
                  index + 2
                )
              : null
        }
      });
    }

    const absoluteOrder = [...submissions]
      .sort((a, b) => b.overallScore - a.overallScore)
      .map((submission) => submission.submissionId.toString());
    const anomalyThreshold = Math.max(2, Math.floor(submissions.length * 0.25));
    for (const result of results) {
      const absoluteRank = absoluteOrder.indexOf(result.submissionId.toString()) + 1;
      result.discrepancyAnomaly = Math.abs(result.rank - absoluteRank) >= anomalyThreshold;
    }
    return results;
  }

  private static compareForDisplay(
    source: SubmissionEvaluationPairInput,
    sourceRank: number,
    target: SubmissionEvaluationPairInput,
    targetRank: number
  ): IRelativeComparison {
    const ids = Array.from(
      new Set([...Object.keys(source.criterionScores), ...Object.keys(target.criterionScores)])
    ).sort();
    const criteriaDeltas = ids.map((criterionId) => {
      const yourScore = source.criterionScores[criterionId] ?? 0;
      const theirScore = target.criterionScores[criterionId] ?? 0;
      const delta = round(yourScore - theirScore);
      return {
        criterionId,
        criterionName:
          source.criterionDetails?.[criterionId]?.name ||
          target.criterionDetails?.[criterionId]?.name ||
          criterionId,
        yourScore,
        theirScore,
        delta,
        feedback:
          delta === 0
            ? 'Scores are equal for this criterion.'
            : `${Math.abs(delta)} point ${delta > 0 ? 'lead' : 'gap'} on this criterion.`
      };
    });
    return {
      targetSubmissionId: target.submissionId,
      targetTeamName: target.teamName,
      targetRank,
      scoreDifference: round(source.overallScore - target.overallScore),
      criteriaDeltas,
      summary: `Rank ${sourceRank} compared with rank ${targetRank} using the same configured rubric.`
    };
  }

  private static relativeGrade(
    submission: SubmissionEvaluationPairInput,
    cohort: SubmissionEvaluationPairInput[]
  ): IRelativeGrading {
    const scores = cohort.map((item) => item.overallScore).sort((a, b) => a - b);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const middle = Math.floor(scores.length / 2);
    const median = scores.length % 2 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2;
    const belowOrEqual = scores.filter((score) => score <= submission.overallScore).length;
    const percentile = round((belowOrEqual / scores.length) * 100, 1);
    const tier: IRelativeGrading['tier'] =
      percentile >= 90
        ? 'S'
        : percentile >= 75
          ? 'A'
          : percentile >= 50
            ? 'B'
            : percentile >= 25
              ? 'C'
              : 'D';
    const tierLabel = {
      S: 'Top decile',
      A: 'Upper quartile',
      B: 'Upper half',
      C: 'Lower half',
      D: 'Lower quartile'
    }[tier];
    const criterionIds = Object.keys(submission.criterionScores).sort();
    return {
      tier,
      tierLabel,
      percentile,
      cohortAverage: round(average, 1),
      cohortMedian: round(median, 1),
      cohortMin: scores[0],
      cohortMax: scores[scores.length - 1],
      scoreDeltaFromAverage: round(submission.overallScore - average, 1),
      whyTheseMarks: `Position is calculated from the cohort's persisted scores; evidence coverage is ${round((submission.evidenceCoverage ?? 0) * 100, 1)}%.`,
      criteriaRelativeMarks: criterionIds.map((criterionId) => {
        const yourScore = submission.criterionScores[criterionId];
        const observed = cohort
          .map((item) => item.criterionScores[criterionId])
          .filter((value): value is number => value !== undefined);
        const criterionAverage = observed.reduce((sum, value) => sum + value, 0) / observed.length;
        const delta = round(yourScore - criterionAverage, 1);
        return {
          criterionId,
          criterionName: submission.criterionDetails?.[criterionId]?.name || criterionId,
          yourScore,
          cohortAverage: round(criterionAverage, 1),
          deltaFromAverage: delta,
          relativeStanding:
            delta >= 10
              ? 'TOP_TIER'
              : delta > 1
                ? 'ABOVE_AVERAGE'
                : delta >= -1
                  ? 'AVERAGE'
                  : 'BELOW_AVERAGE',
          whyThisMark: `Observed delta from the cohort mean: ${delta} points.`
        };
      })
    };
  }
}

export default PairwiseEngine;
