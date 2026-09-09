import { SubmissionEvaluationPairInput } from './types.js';
import logger from '../../shared/config/logger.config.js';

export interface RankingBoundaryPair {
  subA: SubmissionEvaluationPairInput;
  subB: SubmissionEvaluationPairInput;
  scoreDelta: number;
  isAdjacent: boolean;
  boundaryReason: string;
}

export class RankingBoundaryDetector {
  /**
   * Identifies close ranking boundaries where projects have tight score margins.
   * Enables efficient, targeted pairwise comparison without wasteful O(N^2) comparisons on large cohorts.
   *
   * @param sortedSubmissions Submissions sorted by initial score descending
   * @param threshold Score delta threshold (default: 5.0 out of 100 points, or 0.5 on a 10-point scale)
   */
  public static detectCloseBoundaries(
    sortedSubmissions: SubmissionEvaluationPairInput[],
    threshold = 5.0
  ): RankingBoundaryPair[] {
    const n = sortedSubmissions.length;
    if (n <= 1) return [];

    const boundaryPairs: RankingBoundaryPair[] = [];
    const seenPairs = new Set<string>();

    logger.info(
      { totalSubmissions: n, threshold },
      'Detecting critical ranking boundaries for pairwise comparison'
    );

    // Rule 1: Always evaluate immediately adjacent neighbors
    for (let i = 0; i < n - 1; i++) {
      const a = sortedSubmissions[i];
      const b = sortedSubmissions[i + 1];
      const delta = parseFloat(Math.abs(a.overallScore - b.overallScore).toFixed(2));
      const pairKey = `${a.submissionId.toString()}_${b.submissionId.toString()}`;

      seenPairs.add(pairKey);
      boundaryPairs.push({
        subA: a,
        subB: b,
        scoreDelta: delta,
        isAdjacent: true,
        boundaryReason:
          delta <= threshold
            ? `Close ranking boundary: score difference is only ${delta} points (within ${threshold} pt margin).`
            : `Adjacent leaderboard neighbors (#${i + 1} vs #${i + 2}).`
      });
    }

    // Rule 2: For close score clusters (e.g. #1 and #3 within threshold), add non-adjacent boundary pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < Math.min(n, i + 5); j++) {
        const a = sortedSubmissions[i];
        const b = sortedSubmissions[j];
        const delta = parseFloat(Math.abs(a.overallScore - b.overallScore).toFixed(2));
        const pairKey = `${a.submissionId.toString()}_${b.submissionId.toString()}`;

        if (delta <= threshold && !seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          boundaryPairs.push({
            subA: a,
            subB: b,
            scoreDelta: delta,
            isAdjacent: false,
            boundaryReason: `Close cluster neighbor: rank #${i + 1} vs #${j + 1} with tight score gap of ${delta} points.`
          });
        }
      }
    }

    logger.info(
      { detectedBoundariesCount: boundaryPairs.length },
      'Critical ranking boundaries identified'
    );

    return boundaryPairs;
  }
}

export default RankingBoundaryDetector;
