import { Schema, model, Document } from 'mongoose';

export interface IMCQAttempt extends Document {
  _id: any;
  questionId: string;
  userId: string;
  attemptNumber: number;
  selected_option_id: string;
  isCorrect: boolean;
  scoreAwarded: number;
  createdAt: Date;
  updatedAt: Date;
}

const MCQAttemptSchema = new Schema<IMCQAttempt>(
  {
    questionId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    attemptNumber: {
      type: Number,
      required: true
    },
    selected_option_id: {
      type: String,
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
    }
  },
  {
    timestamps: true
  }
);

MCQAttemptSchema.index({ questionId: 1, userId: 1, attemptNumber: 1 }, { unique: true });

const MCQAttempt = model<IMCQAttempt>('MCQAttempt', MCQAttemptSchema);

export default MCQAttempt;
