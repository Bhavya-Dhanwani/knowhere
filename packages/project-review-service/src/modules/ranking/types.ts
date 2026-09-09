import { Types } from 'mongoose';
import {
  IRelativeComparison,
  ISelfImprovement,
  ISelfStrengths,
  IRelativeGrading
} from '../../models/Ranking.model.js';

export interface SubmissionEvaluationPairInput {
  submissionId: Types.ObjectId;
  teamName: string;
  overallScore: number;
  criterionScores: Record<string, number>; // criterionId -> rawScore
  criterionDetails?: Record<
    string,
    { name: string; weight: number; confidence?: number; justification?: string }
  >;
  overallConfidence?: number;
  evidenceCoverage?: number;
  vulnerabilitiesCount?: number;
  submittedAt?: Date;
  fileCount?: number;
  detectedFrameworks?: string[];
  requirementCountFulfilled?: number;
}

export interface PairwiseComparisonResult {
  subA: Types.ObjectId;
  subB: Types.ObjectId;
  winner: Types.ObjectId | 'TIE';
  criterionWins: Record<string, string>;
  margin: number;
  rationale: string;
  tieBreakApplied?: boolean;
}

export interface BradleyTerryRating {
  submissionId: Types.ObjectId;
  teamName: string;
  absoluteScore: number;
  latentRating: number; // Positive float, higher = better
  winRate: number; // 0.0 - 1.0
  rank: number;
  rankReason: string;
  relativeGrading?: IRelativeGrading;
  discrepancyAnomaly: boolean;
  relativeAnalysis?: {
    comparedToAbove?: IRelativeComparison | null;
    comparedToBelow?: IRelativeComparison | null;
    selfImprovement?: ISelfImprovement | null;
    selfStrengths?: ISelfStrengths | null;
  };
}
