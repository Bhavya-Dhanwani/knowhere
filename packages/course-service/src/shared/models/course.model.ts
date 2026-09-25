import mongoose, { Document, Schema, Types } from 'mongoose';

export type CourseStatus = 'draft' | 'published' | 'archived';

export interface ICourseModuleEntry {
  moduleId: Types.ObjectId;
  order: number;
  releasePolicy?: {
    type: 'immediate' | 'scheduled' | 'fixed_schedule' | 'progression_based';
    releaseAt?: Date | null;
    unlockAt?: Date | null;
    allowLateJoinerCatchUp?: boolean;
  };
}

export interface ICourseSettings {
  allowLateEnrollment: boolean;
  defaultModuleDurationDays: number;
  progressionThreshold: number;
}

export interface ICourseDocument extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  instructorId: string;
  status: CourseStatus;
  tags: string[];
  modules: ICourseModuleEntry[];
  settings: ICourseSettings;
  createdAt: Date;
  updatedAt: Date;
}

const courseModuleEntrySchema = new Schema<ICourseModuleEntry>(
  {
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      required: true
    },
    order: {
      type: Number,
      required: true,
      default: 1
    },
    releasePolicy: {
      type: {
        type: String,
        enum: ['immediate', 'scheduled', 'fixed_schedule', 'progression_based'],
        default: 'immediate'
      },
      releaseAt: { type: Date, default: null },
      unlockAt: { type: Date, default: null },
      allowLateJoinerCatchUp: { type: Boolean, default: true }
    }
  },
  { _id: false }
);

const courseSettingsSchema = new Schema<ICourseSettings>(
  {
    allowLateEnrollment: { type: Boolean, default: true },
    defaultModuleDurationDays: { type: Number, default: 7 },
    progressionThreshold: { type: Number, default: 70 }
  },
  { _id: false }
);

const courseSchema = new Schema<ICourseDocument>(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      minlength: [3, 'Course title must be at least 3 characters long']
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    instructorId: {
      type: String,
      required: [true, 'Instructor ID is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true
    },
    tags: {
      type: [String],
      default: []
    },
    modules: {
      type: [courseModuleEntrySchema],
      default: []
    },
    settings: {
      type: courseSettingsSchema,
      default: () => ({
        allowLateEnrollment: true,
        defaultModuleDurationDays: 7,
        progressionThreshold: 70
      })
    }
  },
  {
    timestamps: true
  }
);

const Course = mongoose.model<ICourseDocument>('Course', courseSchema);

export default Course;
