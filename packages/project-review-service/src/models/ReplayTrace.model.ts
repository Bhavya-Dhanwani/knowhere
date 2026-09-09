import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IActivityTrace {
  activityId: string;
  activityName: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
  error?: string;
}

export interface IReplayTrace extends Document {
  workflowId: string;
  submissionId: Types.ObjectId;
  eventId: Types.ObjectId;
  activities: IActivityTrace[];
  executedBy: 'TEMPORAL' | 'EMBEDDED_DURABLE_RUNNER';
  finalStatus: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'FLAGGED';
  totalDurationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const ActivityTraceSchema = new Schema<IActivityTrace>(
  {
    activityId: { type: String, required: true },
    activityName: { type: String, required: true },
    status: {
      type: String,
      enum: ['COMPLETED', 'FAILED', 'SKIPPED'],
      required: true
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
    durationMs: { type: Number, required: true },
    inputSnapshot: { type: Schema.Types.Mixed },
    outputSnapshot: { type: Schema.Types.Mixed },
    error: { type: String }
  },
  { _id: false }
);

const ReplayTraceSchema = new Schema<IReplayTrace>(
  {
    workflowId: { type: String, required: true, unique: true, index: true },
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'ReviewSubmission',
      required: true,
      index: true
    },
    eventId: { type: Schema.Types.ObjectId, ref: 'ReviewEvent', required: true, index: true },
    activities: { type: [ActivityTraceSchema], default: [] },
    executedBy: {
      type: String,
      enum: ['TEMPORAL', 'EMBEDDED_DURABLE_RUNNER'],
      default: 'EMBEDDED_DURABLE_RUNNER'
    },
    finalStatus: {
      type: String,
      enum: ['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'FLAGGED'],
      default: 'RUNNING'
    },
    totalDurationMs: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const ReplayTrace = mongoose.model<IReplayTrace>('ReplayTrace', ReplayTraceSchema);
export default ReplayTrace;
