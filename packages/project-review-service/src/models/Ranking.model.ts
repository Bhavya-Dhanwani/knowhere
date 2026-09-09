import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRelativeComparison {
  targetSubmissionId: Types.ObjectId;
  targetTeamName: string;
  targetRank: number;
  scoreDifference: number; // yourScore - theirScore
  criteriaDeltas: Array<{
    criterionId: string;
    criterionName: string;
    yourScore: number;
    theirScore: number;
    delta: number; // positive = you won, negative = you trailed
    feedback: string;
  }>;
  summary: string;
}

export interface ISelfImprovement {
  title: string;
  currentScore: number;
  potentialScore: number;
  gapPoints: number;
  recommendations: Array<{
    criterionId: string;
    criterionName: string;
    currentScore: number;
    gap: number;
    actionableSteps: string;
  }>;
  industryBestPractices: string[];
  summary: string;
}

export interface ISelfStrengths {
  title: string;
  highlights: Array<{
    criterionId: string;
    criterionName: string;
    score: number;
    accomplishment: string;
  }>;
  summary: string;
}

export interface IRelativeGrading {
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  tierLabel: string;
  percentile: number;
  cohortAverage: number;
  cohortMedian: number;
  cohortMin: number;
  cohortMax: number;
  scoreDeltaFromAverage: number;
  whyTheseMarks: string;
  criteriaRelativeMarks: Array<{
    criterionId: string;
    criterionName: string;
    yourScore: number;
    cohortAverage: number;
    deltaFromAverage: number;
    relativeStanding: 'TOP_TIER' | 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE';
    whyThisMark: string;
  }>;
}

export interface ILeaderboardEntry {
  rank: number;
  submissionId: Types.ObjectId;
  teamName: string;
  absoluteScore: number;
  latentSkillScore: number; // Bradley-Terry latent rating (higher is better)
  winRate: number; // 0.0 - 1.0
  confidenceInterval: [number, number];
  discrepancyAnomalyFlag: boolean; // Flags high divergence between absolute and relative rankings
  rankReason: string; // Detailed, transparent explanation of why this rank was awarded (including tie-breaker)
  relativeGrading?: IRelativeGrading;
  whyAmIExplanation?: any;
  dimensionScores?: Record<string, any>;
  relativeAnalysis?: {
    comparedToAbove?: IRelativeComparison | null;
    comparedToBelow?: IRelativeComparison | null;
    selfImprovement?: ISelfImprovement | null;
    selfStrengths?: ISelfStrengths | null;
  };
}

export interface IPairwiseMatch {
  subA: Types.ObjectId;
  subB: Types.ObjectId;
  winner: Types.ObjectId | 'TIE';
  criterionWins: Record<string, string>; // criterionId -> winning subId or 'TIE'
  dimensionComparisons?: Record<string, any>;
  margin: number;
  rationale: string;
  contradictsInitialOrder?: boolean;
}

export interface IEventRanking extends Document {
  eventId: Types.ObjectId;
  algorithm: 'BRADLEY_TERRY_PAIRWISE' | 'WEIGHTED_ABSOLUTE';
  totalSubmissionsRanked: number;
  totalPairwiseMatches: number;
  leaderboard: ILeaderboardEntry[];
  pairwiseMatrix: IPairwiseMatch[];
  closeRankingBoundaries?: Array<{
    subAId: string;
    subBId: string;
    subAName: string;
    subBName: string;
    scoreDelta: number;
    boundaryReason: string;
  }>;
  comparisonMatrix?: Array<{
    dimension: string;
    dimensionName: string;
    scores: Record<string, number>;
  }>;
  generatedAt: Date;
}

const LeaderboardEntrySchema = new Schema<ILeaderboardEntry>(
  {
    rank: { type: Number, required: true },
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'ReviewSubmission',
      required: true
    },
    teamName: { type: String, required: true },
    absoluteScore: { type: Number, required: true },
    latentSkillScore: { type: Number, required: true },
    winRate: { type: Number, required: true },
    confidenceInterval: { type: [Number], default: [0, 0] },
    discrepancyAnomalyFlag: { type: Boolean, default: false },
    rankReason: { type: String, default: '' },
    relativeGrading: { type: Schema.Types.Mixed, default: null },
    whyAmIExplanation: { type: Schema.Types.Mixed, default: null },
    dimensionScores: { type: Schema.Types.Mixed, default: null },
    relativeAnalysis: { type: Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const PairwiseMatchSchema = new Schema<IPairwiseMatch>(
  {
    subA: { type: Schema.Types.ObjectId, ref: 'ReviewSubmission', required: true },
    subB: { type: Schema.Types.ObjectId, ref: 'ReviewSubmission', required: true },
    winner: { type: Schema.Types.Mixed, required: true },
    criterionWins: { type: Schema.Types.Mixed, default: {} },
    dimensionComparisons: { type: Schema.Types.Mixed, default: {} },
    margin: { type: Number, required: true },
    rationale: { type: String, required: true },
    contradictsInitialOrder: { type: Boolean, default: false }
  },
  { _id: false }
);

const EventRankingSchema = new Schema<IEventRanking>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'ReviewEvent', required: true, index: true },
    algorithm: {
      type: String,
      enum: ['BRADLEY_TERRY_PAIRWISE', 'WEIGHTED_ABSOLUTE'],
      default: 'BRADLEY_TERRY_PAIRWISE'
    },
    totalSubmissionsRanked: { type: Number, required: true },
    totalPairwiseMatches: { type: Number, default: 0 },
    leaderboard: { type: [LeaderboardEntrySchema], default: [] },
    pairwiseMatrix: { type: [PairwiseMatchSchema], default: [] },
    closeRankingBoundaries: { type: [Schema.Types.Mixed], default: [] },
    comparisonMatrix: { type: [Schema.Types.Mixed], default: [] },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const EventRanking = mongoose.model<IEventRanking>('EventRanking', EventRankingSchema);
export default EventRanking;
