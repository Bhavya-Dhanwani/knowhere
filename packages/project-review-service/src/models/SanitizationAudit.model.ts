import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IInjectionMarker {
  pattern: string;
  snippet: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: 'README' | 'LIVE_SITE' | 'API_ERROR' | 'COMMIT_MSG' | 'CODE_COMMENT';
  detectedAt: Date;
}

export interface IExtractedClaims {
  claimedFeatures: string[];
  claimedEndpoints: string[];
  techStackClaims: string[];
  summary: string;
  secondarySafetyPassed?: boolean;
}

export interface ISanitizationAudit extends Document {
  submissionId: Types.ObjectId;
  eventId: Types.ObjectId;
  rawInputExcerptsCount: number;
  delimitedContext: string;
  extractedClaims: IExtractedClaims;
  injectionMarkersFound: IInjectionMarker[];
  flaggedAnomaly: boolean;
  anomalyReason?: string;
  humanReviewRequired: boolean;
  sanitizationPassed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InjectionMarkerSchema = new Schema<IInjectionMarker>(
  {
    pattern: { type: String, required: true },
    snippet: { type: String, required: true },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true
    },
    source: {
      type: String,
      enum: ['README', 'LIVE_SITE', 'API_ERROR', 'COMMIT_MSG', 'CODE_COMMENT'],
      required: true
    },
    detectedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ExtractedClaimsSchema = new Schema<IExtractedClaims>(
  {
    claimedFeatures: { type: [String], default: [] },
    claimedEndpoints: { type: [String], default: [] },
    techStackClaims: { type: [String], default: [] },
    summary: { type: String, default: '' }
  },
  { _id: false }
);

const SanitizationAuditSchema = new Schema<ISanitizationAudit>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'ReviewSubmission',
      required: true,
      index: true
    },
    eventId: { type: Schema.Types.ObjectId, ref: 'ReviewEvent', required: true, index: true },
    rawInputExcerptsCount: { type: Number, default: 0 },
    delimitedContext: { type: String, required: true },
    extractedClaims: { type: ExtractedClaimsSchema, required: true },
    injectionMarkersFound: { type: [InjectionMarkerSchema], default: [] },
    flaggedAnomaly: { type: Boolean, default: false },
    anomalyReason: { type: String },
    humanReviewRequired: { type: Boolean, default: false },
    sanitizationPassed: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const SanitizationAudit = mongoose.model<ISanitizationAudit>(
  'SanitizationAudit',
  SanitizationAuditSchema
);
export default SanitizationAudit;
