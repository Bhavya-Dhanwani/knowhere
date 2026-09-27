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

export interface IFormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'number' | 'select';
  required: boolean;
  options?: string[]; // only for select
  helpText?: string;
}

export interface IReviewEvent extends Document {
  name: string;
  description: string;
  problemStatement: string;
  /** Organiser's free-text judging instructions: what matters, how strictly, what to penalise. */
  judgingPrompt?: string;
  /** Show judgingPrompt to students on the submission page (hidden by default). */
  judgingPromptPublic?: boolean;
  /** Students see scores and feedback only once the organiser publishes them. */
  resultsPublished?: boolean;
  /** Hidden test cases: stdin -> expected stdout, run against the built program (never sent to students). */
  ioTests?: Array<{ name?: string; input: string; expected: string }>;
  /** How to run the built program for ioTests (auto-detected when empty). */
  runCommand?: string;
  projectType: 'FRONTEND' | 'BACKEND' | 'FULLSTACK' | 'CUSTOM';
  status: 'DRAFT' | 'ACTIVE' | 'EVALUATION' | 'COMPLETED';
  requiresLiveUrl?: boolean;
  submissionDeadline?: Date;
  requiresApiSpec?: boolean;
  criteria: ICriterion[];
  requirements: IRequirement[];
  formFields: IFormField[];
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

const FormFieldSchema = new Schema<IFormField>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'textarea', 'url', 'number', 'select'], default: 'text' },
    required: { type: Boolean, default: false },
    options: { type: [String], default: undefined },
    helpText: { type: String }
  },
  { _id: false }
);

const ReviewEventSchema = new Schema<IReviewEvent>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    problemStatement: { type: String, required: true },
    judgingPrompt: { type: String, maxlength: 4000 },
    judgingPromptPublic: { type: Boolean, default: false },
    resultsPublished: { type: Boolean, default: false },
    ioTests: {
      type: [
        {
          _id: false,
          name: String,
          input: { type: String, default: '' },
          expected: { type: String, default: '' }
        }
      ],
      default: []
    },
    runCommand: { type: String, maxlength: 500 },
    projectType: {
      type: String,
      enum: ['FRONTEND', 'BACKEND', 'FULLSTACK', 'CUSTOM'],
      default: 'FULLSTACK'
    },
    requiresLiveUrl: { type: Boolean, default: false },
    submissionDeadline: { type: Date },
    requiresApiSpec: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'EVALUATION', 'COMPLETED'],
      default: 'ACTIVE'
    },
    criteria: { type: [CriterionSchema], default: [] },
    requirements: { type: [RequirementSchema], default: [] },
    formFields: { type: [FormFieldSchema], default: [] },
    strictScoring: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const ReviewEvent = mongoose.model<IReviewEvent>('ReviewEvent', ReviewEventSchema);
export default ReviewEvent;
