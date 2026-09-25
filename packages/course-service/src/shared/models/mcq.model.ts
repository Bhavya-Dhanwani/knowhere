import mongoose, { Document, Schema, Types } from 'mongoose';

export type McqDifficulty = 'easy' | 'medium' | 'hard';

export interface IMcqOption {
  id: string;
  text: string;
  resourceIds?: Types.ObjectId[];
}

export interface IMcqDocument extends Document {
  _id: Types.ObjectId;
  question: string;
  options: IMcqOption[];
  correctOptionIndex: number;
  explanation: string;
  questionResourceIds: Types.ObjectId[];
  explanationResourceIds: Types.ObjectId[];
  tags: string[];
  difficulty: McqDifficulty;
  creatorId: string;
  courseId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const mcqOptionSchema = new Schema<IMcqOption>(
  {
    id: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: [true, 'Option text is required'],
      trim: true
    },
    resourceIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'CourseResource'
      }
    ]
  },
  { _id: false }
);

const mcqSchema = new Schema<IMcqDocument>(
  {
    question: {
      type: String,
      required: [true, 'Question stem is required'],
      trim: true
    },
    options: {
      type: [mcqOptionSchema],
      validate: {
        validator: (opts: IMcqOption[]) => Array.isArray(opts) && opts.length === 4,
        message: 'An MCQ must have exactly 4 options'
      }
    },
    correctOptionIndex: {
      type: Number,
      required: [true, 'Correct option index is required'],
      min: [0, 'Correct option index must be between 0 and 3'],
      max: [3, 'Correct option index must be between 0 and 3']
    },
    explanation: {
      type: String,
      default: '',
      trim: true
    },
    questionResourceIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'CourseResource'
      }
    ],
    explanationResourceIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'CourseResource'
      }
    ],
    tags: {
      type: [String],
      default: []
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy'
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

mcqSchema.index({ courseId: 1, difficulty: 1 });

const MCQ = mongoose.model<IMcqDocument>('CourseMCQ', mcqSchema);

export default MCQ;
