import { Schema, model, Document } from 'mongoose';

export interface ITestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface ICodingQuestion extends Document {
  _id: any;
  title: string;
  description: string;
  starterCode: { [language: string]: string };
  testCases: ITestCase[];
  timeLimitMs: number;
  memoryLimitMb: number;
  max_score: number;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}

const TestCaseSchema = new Schema<ITestCase>(
  {
    input: {
      type: String,
      required: true
    },
    expectedOutput: {
      type: String,
      required: true
    },
    isHidden: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const CodingQuestionSchema = new Schema<ICodingQuestion>(
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
    starterCode: {
      type: Map,
      of: String,
      default: {}
    },
    testCases: {
      type: [TestCaseSchema],
      validate: {
        validator: (tc: ITestCase[]) => tc && tc.length >= 1,
        message: 'At least one testcase is required'
      }
    },
    timeLimitMs: {
      type: Number,
      default: 2000
    },
    memoryLimitMb: {
      type: Number,
      default: 128
    },
    max_score: {
      type: Number,
      required: true,
      default: 10,
      min: [1, 'Max score must be at least 1']
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

const CodingQuestion = model<ICodingQuestion>('CodingQuestion', CodingQuestionSchema);

export default CodingQuestion;
