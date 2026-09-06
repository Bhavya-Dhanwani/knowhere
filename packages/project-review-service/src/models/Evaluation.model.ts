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

export interface IReviewEvaluation extends Document {
  submissionId: Types.ObjectId;
  eventId: Types.ObjectId;
  overallScore: number; // 0 - 100
  criterionScores: ICriterionScoreResult[];
  requirementCompliance: IRequirementComplianceResult[];
  synthesisSummary: string;
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
    criterionScores: { type: [CriterionScoreResultSchema], default: [] },
    requirementCompliance: { type: [RequirementComplianceResultSchema], default: [] },
    synthesisSummary: { type: String, default: '' },
    judgeOverride: { type: JudgeOverrideSchema, default: () => ({ overridden: false }) }
  },
  { timestamps: true }
);

export const ReviewEvaluation = mongoose.model<IReviewEvaluation>(
  'ReviewEvaluation',
  ReviewEvaluationSchema
);
export default ReviewEvaluation;
