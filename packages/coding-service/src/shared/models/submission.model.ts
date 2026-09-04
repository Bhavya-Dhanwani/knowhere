import { Schema, model, Document } from 'mongoose';

export type SubmissionStatus = 'queued' | 'running' | 'completed' | 'failed';
export type EvaluationResult = 'AC' | 'WA' | 'TLE' | 'MLE' | 'CE' | 'RE';

export interface ITestResult {
  testCaseIndex: number;
  status: EvaluationResult;
  timeMs: number;
  memoryMb: number;
  actualOutput?: string;
  errorMessage?: string;
}

export interface ICodingSubmission extends Document {
  _id: any;
  questionId: string;
  userId: string;
  language: string;
  code: string;
  status: SubmissionStatus;
  result?: EvaluationResult;
  scoreAwarded: number;
  passedTestCases: number;
  totalTestCases: number;
  details?: ITestResult[];
  createdAt: Date;
  updatedAt: Date;
}

const CodingSubmissionSchema = new Schema<ICodingSubmission>(
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
    language: {
      type: String,
      required: true
    },
    code: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed'],
      default: 'queued',
      index: true
    },
    result: {
      type: String,
      enum: ['AC', 'WA', 'TLE', 'MLE', 'CE', 'RE'],
      default: null
    },
    scoreAwarded: {
      type: Number,
      default: 0
    },
    passedTestCases: {
      type: Number,
      default: 0
    },
    totalTestCases: {
      type: Number,
      default: 0
    },
    details: {
      type: Array,
      default: []
    }
  },
  {
    timestamps: true
  }
);

const CodingSubmission = model<ICodingSubmission>('CodingSubmission', CodingSubmissionSchema);

export default CodingSubmission;
