import mongoose, { Document, Schema, Types } from 'mongoose';

export type LearnerModuleStatus = 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'expired';

export interface ILearnerModuleProgressDocument extends Document {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  moduleId: Types.ObjectId;
  userId: string;
  unlockedAt: Date;
  deadline: Date;
  status: LearnerModuleStatus;
  progressPercentage: number;
  completedItems: Types.ObjectId[];
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const learnerModuleProgressSchema = new Schema<ILearnerModuleProgressDocument>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    unlockedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    deadline: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['locked', 'unlocked', 'in_progress', 'completed', 'expired'],
      default: 'unlocked',
      index: true
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    completedItems: [
      {
        type: Schema.Types.ObjectId
      }
    ],
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

learnerModuleProgressSchema.index({ courseId: 1, moduleId: 1, userId: 1 }, { unique: true });

const LearnerModuleProgress = mongoose.model<ILearnerModuleProgressDocument>(
  'LearnerModuleProgress',
  learnerModuleProgressSchema
);

export default LearnerModuleProgress;
