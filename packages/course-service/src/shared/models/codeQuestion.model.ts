import mongoose, { Document, Schema, Types } from 'mongoose';

export type CodingDifficulty = 'easy' | 'medium' | 'hard';

export type TestCaseGenerationStatus = 'NOT_REQUESTED' | 'PENDING' | 'COMPLETED' | 'FAILED';

export interface IExampleCase {
  input: string;
  output: string;
  explanation?: string;
}

export interface ICodingTestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface ICodingQuestionDocument extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  examples: IExampleCase[];
  difficulty: CodingDifficulty;
  supportedLanguages: string[];
  testCases: ICodingTestCase[];
  testCaseGenerationStatus: TestCaseGenerationStatus;
  creatorId: string;
  courseId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const exampleCaseSchema = new Schema<IExampleCase>(
  {
    input: { type: String, required: true },
    output: { type: String, required: true },
    explanation: { type: String, default: '' }
  },
  { _id: false }
);

const testCaseSchema = new Schema<ICodingTestCase>(
  {
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isHidden: { type: Boolean, default: false }
  },
  { _id: false }
);

const codingQuestionSchema = new Schema<ICodingQuestionDocument>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true
    },
    constraints: {
      type: [String],
      required: [true, 'Constraints are required'],
      default: []
    },
    inputFormat: {
      type: String,
      required: [true, 'Input format is required'],
      trim: true
    },
    outputFormat: {
      type: String,
      required: [true, 'Output format is required'],
      trim: true
    },
    examples: {
      type: [exampleCaseSchema],
      validate: {
        validator: (exs: IExampleCase[]) => Array.isArray(exs) && exs.length <= 5,
        message: 'A maximum of 5 public examples are allowed'
      },
      default: []
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy'
    },
    supportedLanguages: {
      type: [String],
      required: [true, 'Supported languages are required'],
      default: ['javascript', 'python', 'cpp', 'c']
    },
    testCases: {
      type: [testCaseSchema],
      default: []
    },
    testCaseGenerationStatus: {
      type: String,
      enum: ['NOT_REQUESTED', 'PENDING', 'COMPLETED', 'FAILED'],
      default: 'NOT_REQUESTED'
    },
    creatorId: {
      type: String,
      required: [true, 'Creator user ID is required'],
      index: true
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

codingQuestionSchema.index({ courseId: 1, difficulty: 1 });

const CodeQuestion = mongoose.model<ICodingQuestionDocument>(
  'CourseCodingQuestion',
  codingQuestionSchema
);

export default CodeQuestion;
