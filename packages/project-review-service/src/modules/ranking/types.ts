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
  criterionDetails?: Record<string, { name: string; weight: number; justification?: string }>;
  dimensionScores?: Record<
    string,
    {
      objectiveScore: number;
      qualitativeScore: number;
      finalScore: number;
      findings?: Array<{
        observedFact: string;
        interpretation: string;
        aiJudgment: string;
        sourceFiles: string[];
      }>;
      strengths?: string[];
      weaknesses?: string[];
    }
  >;
  highestImpactImprovements?: string[];
  confidenceScore?: number;
  vulnerabilitiesCount?: number;
  submittedAt?: Date;
  fileCount?: number;
  detectedFrameworks?: string[];
  requirementCountFulfilled?: number;
}

export interface DimensionPairwiseComparison {
  dimension: string;
  dimensionName: string;
  winner: 'A' | 'B' | 'TIE' | 'INSUFFICIENT_EVIDENCE';
  winnerTeamName: string;
  scoreA: number;
  scoreB: number;
  reason: string;
  sourceEvidence: string[];
}

export interface PairwiseComparisonResult {
  subA: Types.ObjectId;
  subB: Types.ObjectId;
  winner: Types.ObjectId | 'TIE';
  criterionWins: Record<string, string>;
  dimensionComparisons?: Record<string, DimensionPairwiseComparison>;
  margin: number;
  rationale: string;
  tieBreakApplied?: boolean;
  contradictsInitialOrder?: boolean;
}

export interface RedesignWhyThisRankExplanation {
  submissionId: Types.ObjectId;
  rank: number;
  score: number;
  confidenceScore: number;
  whyThisRankHeadline: string;
  whyRankedAboveBelow: {
    rankedAboveNext?: {
      targetTeamName: string;
      targetScore: number;
      keyAdvantages: string[];
      reason: string;
    } | null;
    rankedBelowPrevious?: {
      targetTeamName: string;
      targetScore: number;
      keyDeficits: string[];
      higherRankedAdvantages: string[];
      yourAdvantagesOverThem: string[];
      reason: string;
    } | null;
  };
  comparisonWithChampion?: {
    championTeamName: string;
    championScore: number;
    championKeyStrengths: string[];
    yourAdvantagesOverChampion: string[];
  } | null;
  highestImpactImprovements: string[];
}

export interface BradleyTerryRating {
  submissionId: Types.ObjectId;
  teamName: string;
  absoluteScore: number;
  latentRating: number;
  winRate: number;
  rank: number;
  rankReason: string;
  relativeGrading?: IRelativeGrading;
  discrepancyAnomaly: boolean;
  whyAmIExplanation?: RedesignWhyThisRankExplanation;
  relativeAnalysis?: {
    comparedToAbove?: IRelativeComparison | null;
    comparedToBelow?: IRelativeComparison | null;
    selfImprovement?: ISelfImprovement | null;
    selfStrengths?: ISelfStrengths | null;
  };
}
