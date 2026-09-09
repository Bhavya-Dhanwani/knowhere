import mongoose, { Schema, Document, Types } from 'mongoose';
import type {
  BackendEvalResult,
  BuildTestEvalResult,
  CodeAnalysisResult,
  DiscoveryResult,
  FrontendEvalResult,
  ToolExecutionRecord
} from '../modules/runners/types.js';

export interface PersistedRepositorySnapshot {
  repositoryUrl: string;
  requestedBranch: string;
  commitSha: string;
  clonedAt: string;
  clone: ToolExecutionRecord;
}

export interface IEvidence extends Document {
  submissionId: Types.ObjectId;
  eventId: Types.ObjectId;
  schemaVersion: number;
  repository: PersistedRepositorySnapshot;
  discovery: DiscoveryResult;
  codeAnalysis: CodeAnalysisResult;
  buildTest?: BuildTestEvalResult;
  frontendEval?: FrontendEvalResult;
  backendEval?: BackendEvalResult;
  createdAt: Date;
  updatedAt: Date;
}

// Evidence changes frequently as runners evolve. Mixed subdocuments preserve the
// exact, versioned runner payload rather than silently discarding new fields.
const EvidenceSchema = new Schema<IEvidence>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'ReviewSubmission',
      required: true,
      unique: true,
      index: true
    },
    eventId: { type: Schema.Types.ObjectId, ref: 'ReviewEvent', required: true, index: true },
    schemaVersion: { type: Number, required: true, default: 7 },
    repository: { type: Schema.Types.Mixed, required: true },
    discovery: { type: Schema.Types.Mixed, required: true },
    codeAnalysis: { type: Schema.Types.Mixed, required: true },
    buildTest: { type: Schema.Types.Mixed },
    frontendEval: { type: Schema.Types.Mixed },
    backendEval: { type: Schema.Types.Mixed }
  },
  { timestamps: true, minimize: false }
);

EvidenceSchema.index({ eventId: 1, createdAt: -1 });

export const Evidence = mongoose.model<IEvidence>('Evidence', EvidenceSchema);
export default Evidence;
