// Importing modules
import mongoose, { Document, Schema } from 'mongoose';

export interface ICompletedItem {
  contentItemId: mongoose.Types.ObjectId;
  type: 'video' | 'notes' | 'mcq' | 'coding';
  scoreEarned: number;
  maxScore: number;
  completedAt: Date;
}

export interface ICourseProgress extends Document {
  courseId: mongoose.Types.ObjectId;
  userId: string;
  totalScoreEarned: number;
  completedItems: ICompletedItem[];
  createdAt: Date;
  updatedAt: Date;
}

const completedItemSchema = new Schema<ICompletedItem>(
  {
    contentItemId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    type: {
      type: String,
      enum: ['video', 'notes', 'mcq', 'coding'],
      required: true
    },
    scoreEarned: {
      type: Number,
      required: true,
      default: 0
    },
    maxScore: {
      type: Number,
      required: true,
      default: 0
    },
    completedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const courseProgressSchema = new Schema<ICourseProgress>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    totalScoreEarned: {
      type: Number,
      required: true,
      default: 0
    },
    completedItems: {
      type: [completedItemSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// One progress document per user per course
courseProgressSchema.index({ courseId: 1, userId: 1 }, { unique: true });

const CourseProgress = mongoose.model<ICourseProgress>('CourseProgress', courseProgressSchema);

export default CourseProgress;
