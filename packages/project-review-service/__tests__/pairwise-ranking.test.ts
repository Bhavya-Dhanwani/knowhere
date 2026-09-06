import { Types } from 'mongoose';
import { PairwiseEngine } from '../src/modules/ranking/pairwise.engine.js';
import { SubmissionEvaluationPairInput } from '../src/modules/ranking/types.js';

describe('Relative Ranking & Pairwise Engine (§4, §5)', () => {
  it('should compare two submissions across criteria and determine head-to-head winner', () => {
    const subA: SubmissionEvaluationPairInput = {
      submissionId: new Types.ObjectId(),
      teamName: 'Team Alpha',
      overallScore: 88,
      criterionScores: {
        security: 90,
        code_quality: 85,
        frontend: 80,
        backend_api: 95
      }
    };

    const subB: SubmissionEvaluationPairInput = {
      submissionId: new Types.ObjectId(),
      teamName: 'Team Beta',
      overallScore: 78,
      criterionScores: {
        security: 70,
        code_quality: 75,
        frontend: 85,
        backend_api: 80
      }
    };

    const match = PairwiseEngine.compare(subA, subB);

    expect(match.winner).toEqual(subA.submissionId);
    expect(match.margin).toBe(2); // 3 wins for A vs 1 win for B -> margin 2
    expect(match.rationale).toContain('Team Alpha outperformed Team Beta on 3/4 criteria');
  });

  it('should compute Bradley-Terry latent ratings and leaderboard for multiple submissions', () => {
    const sub1: SubmissionEvaluationPairInput = {
      submissionId: new Types.ObjectId(),
      teamName: 'Team 1 (Strongest)',
      overallScore: 92,
      criterionScores: { crit1: 95, crit2: 90, crit3: 92 }
    };

    const sub2: SubmissionEvaluationPairInput = {
      submissionId: new Types.ObjectId(),
      teamName: 'Team 2 (Mid)',
      overallScore: 80,
      criterionScores: { crit1: 82, crit2: 78, crit3: 80 }
    };

    const sub3: SubmissionEvaluationPairInput = {
      submissionId: new Types.ObjectId(),
      teamName: 'Team 3 (Low)',
      overallScore: 65,
      criterionScores: { crit1: 65, crit2: 60, crit3: 70 }
    };

    const submissions = [sub1, sub2, sub3];

    // Generate matches
    const matches = [
      PairwiseEngine.compare(sub1, sub2),
      PairwiseEngine.compare(sub1, sub3),
      PairwiseEngine.compare(sub2, sub3)
    ];

    const ratings = PairwiseEngine.computeBradleyTerryRatings(submissions, matches);

    expect(ratings.length).toBe(3);
    // Rank 1 should be sub1
    expect(ratings[0].submissionId).toEqual(sub1.submissionId);
    expect(ratings[0].rank).toBe(1);
    expect(ratings[0].winRate).toBe(1.0); // Won both matches

    // Rank 3 should be sub3
    expect(ratings[2].submissionId).toEqual(sub3.submissionId);
    expect(ratings[2].rank).toBe(3);
    expect(ratings[2].winRate).toBe(0.0); // Lost both matches

    // Ratings must be strictly monotonically decreasing
    expect(ratings[0].latentRating).toBeGreaterThan(ratings[1].latentRating);
    expect(ratings[1].latentRating).toBeGreaterThan(ratings[2].latentRating);
  });
});
