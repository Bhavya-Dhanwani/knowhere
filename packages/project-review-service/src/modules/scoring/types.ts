import { z } from 'zod';

// ==========================================
// 1. RE:DESIGN 9 Engineering Dimensions
// ==========================================
export const ENGINEERING_DIMENSIONS = [
  'architecture',
  'codeQuality',
  'maintainability',
  'testing',
  'reliability',
  'complexity',
  'engineeringPractices',
  'securityPractices',
  'technicalDebt'
] as const;

export type EngineeringDimension = (typeof ENGINEERING_DIMENSIONS)[number];

export const DIMENSION_DISPLAY_NAMES: Record<EngineeringDimension, string> = {
  architecture: 'Architecture',
  codeQuality: 'Code Quality',
  maintainability: 'Maintainability',
  testing: 'Testing',
  reliability: 'Reliability',
  complexity: 'Complexity',
  engineeringPractices: 'Engineering Practices',
  securityPractices: 'Security Practices',
  technicalDebt: 'Technical Debt'
};

// Default balanced weightings for the 9 dimensions (sum = 1.0)
export const DEFAULT_DIMENSION_WEIGHTS: Record<EngineeringDimension, number> = {
  architecture: 0.15,
  codeQuality: 0.15,
  maintainability: 0.15,
  testing: 0.1,
  reliability: 0.1,
  complexity: 0.1,
  engineeringPractices: 0.1,
  securityPractices: 0.1,
  technicalDebt: 0.05
};

// ==========================================
// 2. Evidence-First Schemas
// (Observed Fact -> Interpretation -> Judgment)
// ==========================================
export const StructuredEvidenceFindingSchema = z.object({
  id: z.string().optional(),
  dimension: z.enum(ENGINEERING_DIMENSIONS),
  observedFact: z.string().min(5),
  interpretation: z.string().min(5),
  aiJudgment: z.string().min(5),
  scoreImpact: z.number().default(0),
  sourceFiles: z.array(z.string()).default([])
});

export type StructuredEvidenceFinding = z.infer<typeof StructuredEvidenceFindingSchema>;

export const DimensionScoreResultSchema = z.object({
  dimension: z.enum(ENGINEERING_DIMENSIONS),
  dimensionName: z.string(),
  objectiveScore: z.number().min(0).max(100),
  qualitativeScore: z.number().min(0).max(100),
  finalScore: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  findings: z.array(StructuredEvidenceFindingSchema).default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([])
});

export type DimensionScoreResult = z.infer<typeof DimensionScoreResultSchema>;

// ==========================================
// 3. Legacy Rubric Compatibility Schemas
// ==========================================
export const CriterionScoreSchema = z.object({
  criterionId: z.string(),
  name: z.string(),
  rawScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  evidenceCitations: z.array(z.string()),
  justification: z.string().min(10)
});

export type CriterionScore = z.infer<typeof CriterionScoreSchema>;

export const RequirementComplianceSchema = z.object({
  requirementId: z.string(),
  title: z.string(),
  status: z.enum(['FULFILLED', 'PARTIAL', 'NOT_FULFILLED', 'UNKNOWN']),
  evidenceSummary: z.string().min(5)
});

export type RequirementCompliance = z.infer<typeof RequirementComplianceSchema>;

export const EvaluationResultSchema = z.object({
  criterionScores: z.array(CriterionScoreSchema),
  requirementCompliance: z.array(RequirementComplianceSchema),
  synthesisSummary: z.string().min(20)
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// ==========================================
// 4. RE:DESIGN Comprehensive Evaluation
// ==========================================
export interface RedesignProjectEvaluation {
  overallScore: number; // 0 - 100
  objectiveScore: number; // 0 - 100
  qualitativeScore: number; // 0 - 100
  confidenceScore: number; // 0 - 100 (%)
  dimensionScores: Record<EngineeringDimension, DimensionScoreResult>;
  evidenceList: StructuredEvidenceFinding[];
  highestImpactImprovements: string[];
  reproducibility: {
    evaluationId: string;
    repoUrl: string;
    commitHash?: string;
    timestamp: string;
    frameworkVersion: string;
    modelVersion: string;
    promptsVersion: string;
  };
}
