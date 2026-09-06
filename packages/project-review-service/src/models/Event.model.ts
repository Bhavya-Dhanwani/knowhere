import mongoose, { Schema, Document } from 'mongoose';

export interface ICriterion {
  id: string;
  name: string;
  category:
    'CODE_QUALITY' | 'SECURITY' | 'FRONTEND' | 'BACKEND_API' | 'REQUIREMENTS' | 'INNOVATION';
  weight: number; // e.g. 0.25 (sum of all criteria = 1.0)
  description: string;
  minScore: number;
  maxScore: number;
}

export interface IRequirement {
  id: string;
  title: string;
  description: string;
  mandatory: boolean;
  targetEndpointOrFile?: string;
}

export interface IReviewEvent extends Document {
  name: string;
  description: string;
  problemStatement: string;
  projectType: 'FRONTEND' | 'BACKEND' | 'FULLSTACK' | 'CUSTOM';
  status: 'DRAFT' | 'ACTIVE' | 'EVALUATION' | 'COMPLETED';
  requiresLiveUrl?: boolean;
  requiresApiSpec?: boolean;
  criteria: ICriterion[];
  requirements: IRequirement[];
  strictScoring: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CriterionSchema = new Schema<ICriterion>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['CODE_QUALITY', 'SECURITY', 'FRONTEND', 'BACKEND_API', 'REQUIREMENTS', 'INNOVATION'],
      required: true
    },
    weight: { type: Number, required: true, min: 0, max: 1 },
    description: { type: String, required: true },
    minScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 100 }
  },
  { _id: false }
);

const RequirementSchema = new Schema<IRequirement>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    mandatory: { type: Boolean, default: false },
    targetEndpointOrFile: { type: String }
  },
  { _id: false }
);

const ReviewEventSchema = new Schema<IReviewEvent>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    problemStatement: { type: String, required: true },
    projectType: {
      type: String,
      enum: ['FRONTEND', 'BACKEND', 'FULLSTACK', 'CUSTOM'],
      default: 'FULLSTACK'
    },
    requiresLiveUrl: { type: Boolean, default: false },
    requiresApiSpec: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'EVALUATION', 'COMPLETED'],
      default: 'ACTIVE'
    },
    criteria: { type: [CriterionSchema], default: [] },
    requirements: { type: [RequirementSchema], default: [] },
    strictScoring: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const ReviewEvent = mongoose.model<IReviewEvent>('ReviewEvent', ReviewEventSchema);
export default ReviewEvent;
