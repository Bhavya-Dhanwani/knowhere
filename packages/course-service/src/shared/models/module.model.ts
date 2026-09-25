import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IModuleReleasePolicy {
  type: 'immediate' | 'scheduled' | 'fixed_schedule' | 'progression_based';
  unlockAt?: Date | null;
  releaseAt?: Date | null;
  allowLateJoinerCatchUp?: boolean;
}

export interface IModuleDocument extends Document {
  _id: Types.ObjectId;
  courseId?: Types.ObjectId | null;
  title: string;
  description: string;
  submoduleIds: Types.ObjectId[];
  durationDays: number;
  releasePolicy: IModuleReleasePolicy;
  progressRequirement: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const moduleReleasePolicySchema = new Schema<IModuleReleasePolicy>(
  {
    type: {
      type: String,
      enum: ['immediate', 'scheduled', 'fixed_schedule', 'progression_based'],
      default: 'immediate'
    },
    unlockAt: { type: Date, default: null },
    releaseAt: { type: Date, default: null },
    allowLateJoinerCatchUp: { type: Boolean, default: true }
  },
  { _id: false }
);

const moduleSchema = new Schema<IModuleDocument>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Module title is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    submoduleIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Submodule'
      }
    ],
    durationDays: {
      type: Number,
      required: [true, 'durationDays is required'],
      min: [1, 'durationDays must be at least 1 day'],
      default: 7
    },
    releasePolicy: {
      type: moduleReleasePolicySchema,
      default: () => ({
        type: 'immediate',
        unlockAt: null,
        releaseAt: null,
        allowLateJoinerCatchUp: true
      })
    },
    progressRequirement: {
      type: Number,
      min: [0, 'Progress requirement must be between 0 and 100'],
      max: [100, 'Progress requirement must be between 0 and 100'],
      default: 70
    },
    order: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

const Module = mongoose.model<IModuleDocument>('Module', moduleSchema);

export default Module;
