import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICriterionScoreResult {
  criterionId: string;
  name: string;
  rawScore: number; // 0 - 100
  weightedScore: number;
  confidence: number; // 0.0 - 1.0
  evidenceCitations: string[];
  justification: string;
}

export interface IRequirementComplianceResult {
  requirementId: string;
  title: string;
  status: 'FULFILLED' | 'PARTIAL' | 'NOT_FULFILLED' | 'UNKNOWN';
  evidenceSummary: string;
}

export interface IJudgeOverride {
  overridden: boolean;
  judgeId?: string;
  originalScore?: number;
  newScore?: number;
  reason?: string;
  overriddenAt?: Date;
}

export interface IActionableReview {
  overview: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface IEvaluationProvenance {
  engineVersion: string;
  evaluator: string;
  modelName?: string;
  promptVersion: string;
  criteriaConfigSha256: string;
  evidenceSha256: string;
}

export interface IReviewEvaluation extends Document {
  submissionId: Types.ObjectId;
  eventId: Types.ObjectId;
  overallScore: number; // 0 - 100
  overallConfidence: number;
  evidenceCoverage: number;
  evaluationStatus: 'COMPLETE' | 'PARTIAL';
  criterionScores: ICriterionScoreResult[];
  requirementCompliance: IRequirementComplianceResult[];
  synthesisSummary: string;
  review: IActionableReview;
  provenance: IEvaluationProvenance;
  judgeOverride: IJudgeOverride;
  createdAt: Date;
  updatedAt: Date;
}

const CriterionScoreResultSchema = new Schema<ICriterionScoreResult>(
  {
    criterionId: { type: String, required: true },
    name: { type: String, required: true },
    rawScore: { type: Number, required: true, min: 0, max: 100 },
    weightedScore: { type: Number, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    evidenceCitations: { type: [String], default: [] },
    justification: { type: String, required: true }
  },
  { _id: false }
);

const RequirementComplianceResultSchema = new Schema<IRequirementComplianceResult>(
  {
    requirementId: { type: String, required: true },
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ['FULFILLED', 'PARTIAL', 'NOT_FULFILLED', 'UNKNOWN'],
      required: true
    },
    evidenceSummary: { type: String, required: true }
  },
  { _id: false }
);

const JudgeOverrideSchema = new Schema<IJudgeOverride>(
  {
    overridden: { type: Boolean, default: false },
    judgeId: { type: String },
    originalScore: { type: Number },
    newScore: { type: Number },
    reason: { type: String },
    overriddenAt: { type: Date }
  },
  { _id: false }
);

const ActionableReviewSchema = new Schema<IActionableReview>(
  {
    overview: { type: String, required: true },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    suggestions: { type: [String], default: [] }
  },
  { _id: false }
);

const EvaluationProvenanceSchema = new Schema<IEvaluationProvenance>(
  {
    engineVersion: { type: String, required: true },
    evaluator: { type: String, required: true },
    modelName: { type: String },
    promptVersion: { type: String, required: true },
    criteriaConfigSha256: { type: String, required: true },
    evidenceSha256: { type: String, required: true }
  },
  { _id: false }
);

const ReviewEvaluationSchema = new Schema<IReviewEvaluation>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'ReviewSubmission',
      required: true,
      index: true
    },
    eventId: { type: Schema.Types.ObjectId, ref: 'ReviewEvent', required: true, index: true },
    overallScore: { type: Number, required: true, min: 0, max: 100 },
    overallConfidence: { type: Number, required: true, min: 0, max: 1, default: 0 },
    evidenceCoverage: { type: Number, required: true, min: 0, max: 1, default: 0 },
    evaluationStatus: {
      type: String,
      enum: ['COMPLETE', 'PARTIAL'],
      required: true,
      default: 'PARTIAL'
    },
    criterionScores: { type: [CriterionScoreResultSchema], default: [] },
    requirementCompliance: { type: [RequirementComplianceResultSchema], default: [] },
    synthesisSummary: { type: String, default: '' },
    review: { type: ActionableReviewSchema, required: true },
    provenance: { type: EvaluationProvenanceSchema, required: true },
    judgeOverride: { type: JudgeOverrideSchema, default: () => ({ overridden: false }) }
  },
  { timestamps: true }
);

export const ReviewEvaluation = mongoose.model<IReviewEvaluation>(
  'ReviewEvaluation',
  ReviewEvaluationSchema
);
export default ReviewEvaluation;
