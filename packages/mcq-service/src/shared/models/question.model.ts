import { Schema, model, Document } from 'mongoose';

export interface IMCQOption {
  id: string;
  text: string;
}

export interface IMCQQuestion extends Document {
  _id: any;
  title: string;
  stem: string;
  options: IMCQOption[];
  correct_option_id: string;
  max_score: number;
  explanation?: string;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}

const MCQOptionSchema = new Schema<IMCQOption>(
  {
    id: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    }
  },
  { _id: false }
);

const MCQQuestionSchema = new Schema<IMCQQuestion>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },
    stem: {
      type: String,
      required: [true, 'Question stem is required'],
      trim: true
    },
    options: {
      type: [MCQOptionSchema],
      validate: {
        validator: (opts: IMCQOption[]) => opts && opts.length >= 2,
        message: 'A question must have at least 2 options'
      }
    },
    correct_option_id: {
      type: String,
      required: [true, 'Correct option ID is required']
    },
    max_score: {
      type: Number,
      required: true,
      default: 1,
      min: [1, 'Max score must be at least 1']
    },
    explanation: {
      type: String,
      default: ''
    },
    creatorId: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

const MCQQuestion = model<IMCQQuestion>('MCQQuestion', MCQQuestionSchema);

export default MCQQuestion;
