import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReviewSubmission extends Document {
  eventId: Types.ObjectId;
  teamName: string;
  teamId: string;
  author: {
    userId: string;
    name?: string;
    email?: string;
  };
  repositoryUrl: string;
  branch: string;
  commitHash?: string;
  liveSiteUrl?: string;
  apiSpecUrl?: string;
  rawReadmeText?: string;
  status:
    | 'SUBMITTED'
    | 'UPDATING'
    | 'QUEUED'
    | 'CLONING'
    | 'DISCOVERING'
    | 'SANITIZING'
    | 'STATIC_ANALYSIS'
    | 'BUILDING'
    | 'TESTING'
    | 'RUNTIME_ANALYSIS'
    | 'BROWSER_ANALYSIS'
    | 'EVIDENCE_COLLECTION'
    | 'AI_EVALUATION'
    | 'SCORING'
    | 'PAIRWISE_COMPARISON'
    | 'RANKING'
    | 'REVIEW_GENERATION'
    | 'VALIDATION'
    | 'REPORT_GENERATION'
    | 'EVALUATED'
    | 'PARTIAL'
    | 'FAILED'
    | 'FLAGGED_FOR_REVIEW';
  flaggedForHumanReview: boolean;
  flagReason?: string;
  currentWorkflowId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSubmissionSchema = new Schema<IReviewSubmission>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'ReviewEvent', required: true, index: true },
    teamName: { type: String, required: true },
    teamId: { type: String, required: true },
    author: {
      userId: { type: String, required: true },
      name: { type: String },
      email: { type: String }
    },
    repositoryUrl: { type: String, required: true },
    branch: { type: String, default: 'main' },
    commitHash: { type: String },
    liveSiteUrl: { type: String },
    apiSpecUrl: { type: String },
    rawReadmeText: { type: String },
    status: {
      type: String,
      enum: [
        'SUBMITTED',
        'UPDATING',
        'QUEUED',
        'CLONING',
        'DISCOVERING',
        'SANITIZING',
        'STATIC_ANALYSIS',
        'BUILDING',
        'TESTING',
        'RUNTIME_ANALYSIS',
        'BROWSER_ANALYSIS',
        'EVIDENCE_COLLECTION',
        'AI_EVALUATION',
        'SCORING',
        'PAIRWISE_COMPARISON',
        'RANKING',
        'REVIEW_GENERATION',
        'VALIDATION',
        'REPORT_GENERATION',
        'EVALUATED',
        'PARTIAL',
        'FAILED',
        'FLAGGED_FOR_REVIEW'
      ],
      default: 'SUBMITTED'
    },
    flaggedForHumanReview: { type: Boolean, default: false },
    flagReason: { type: String },
    currentWorkflowId: { type: String }
  },
  { timestamps: true }
);

export const ReviewSubmission = mongoose.model<IReviewSubmission>(
  'ReviewSubmission',
  ReviewSubmissionSchema
);
export default ReviewSubmission;
