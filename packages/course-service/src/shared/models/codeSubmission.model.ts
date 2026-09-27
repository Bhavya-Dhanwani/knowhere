import mongoose, { Document, Schema } from 'mongoose';

// One graded submission of a coding question (the "Submissions" tab). Hidden test inputs are
// never stored here; only the verdict, counts and the learner's own code.
export interface ICodeSubmissionDocument extends Document {
  userId: string;
  questionId: string;
  courseId: string;
  itemId: string;
  language: string;
  code: string;
  status: string;
  passed: number;
  total: number;
  runtimeMs: number;
  createdAt: Date;
}

const codeSubmissionSchema = new Schema<ICodeSubmissionDocument>(
  {
    userId: { type: String, required: true },
    questionId: { type: String, required: true },
    courseId: { type: String, required: true },
    itemId: { type: String, required: true },
    language: { type: String, required: true },
    code: { type: String, required: true },
    status: { type: String, required: true },
    passed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    runtimeMs: { type: Number, default: 0 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

codeSubmissionSchema.index({ userId: 1, questionId: 1, createdAt: -1 });

const CodeSubmission = mongoose.model<ICodeSubmissionDocument>(
  'CourseCodeSubmission',
  codeSubmissionSchema
);

export default CodeSubmission;
