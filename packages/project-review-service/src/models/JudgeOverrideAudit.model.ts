import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IJudgeOverrideAudit extends Document {
  submissionId: Types.ObjectId;
  evaluationId: Types.ObjectId;
  eventId: Types.ObjectId;
  judgeId: string;
  originalScore: number;
  newScore: number;
  reason: string;
  createdAt: Date;
}

const JudgeOverrideAuditSchema = new Schema<IJudgeOverrideAudit>(
  {
    submissionId: { type: Schema.Types.ObjectId, required: true, index: true },
    evaluationId: { type: Schema.Types.ObjectId, required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, required: true, index: true },
    judgeId: { type: String, required: true },
    originalScore: { type: Number, required: true, min: 0, max: 100 },
    newScore: { type: Number, required: true, min: 0, max: 100 },
    reason: { type: String, required: true, minlength: 10 },
    createdAt: { type: Date, immutable: true, default: Date.now }
  },
  { versionKey: false, timestamps: false }
);

JudgeOverrideAuditSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany'],
  function () {
    throw new Error('Judge override audit records are append-only.');
  }
);

export const JudgeOverrideAudit = mongoose.model<IJudgeOverrideAudit>(
  'JudgeOverrideAudit',
  JudgeOverrideAuditSchema
);

export default JudgeOverrideAudit;
