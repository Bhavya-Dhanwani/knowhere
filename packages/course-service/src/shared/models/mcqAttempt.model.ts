import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMcqAttemptDocument extends Document {
  _id: Types.ObjectId;
  mcqId: Types.ObjectId;
  userId: string;
  courseId?: Types.ObjectId | null;
  selectedOptionId: string;
  selectedOptionIndex: number;
  isCorrect: boolean;
  scoreAwarded: number;
  attemptNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

const mcqAttemptSchema = new Schema<IMcqAttemptDocument>(
  {
    mcqId: {
      type: Schema.Types.ObjectId,
      ref: 'CourseMCQ',
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true
    },
    selectedOptionId: {
      type: String,
      required: true
    },
    selectedOptionIndex: {
      type: Number,
      required: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    },
    scoreAwarded: {
      type: Number,
      required: true,
      default: 0
    },
    attemptNumber: {
      type: Number,
      required: true,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

mcqAttemptSchema.index({ mcqId: 1, userId: 1, attemptNumber: 1 });

const MCQAttempt = mongoose.model<IMcqAttemptDocument>('CourseMCQAttempt', mcqAttemptSchema);

export default MCQAttempt;
