import { z } from 'zod';

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
