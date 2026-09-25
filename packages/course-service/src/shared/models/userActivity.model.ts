import mongoose, { Document, Schema, Types } from 'mongoose';

export type UserActivityEventType =
  | 'COURSE_ENROLLED'
  | 'COURSE_COMPLETED'
  | 'MODULE_UNLOCKED'
  | 'MODULE_COMPLETED'
  | 'SUBMODULE_COMPLETED'
  | 'VIDEO_STARTED'
  | 'VIDEO_PAUSED'
  | 'VIDEO_RESUMED'
  | 'VIDEO_COMPLETED'
  | 'VIDEO_WATCH_DURATION'
  | 'RESOURCE_OPENED'
  | 'RESOURCE_DOWNLOADED'
  | 'MCQ_ATTEMPTED'
  | 'MCQ_ANSWERED_CORRECT'
  | 'MCQ_ANSWERED_INCORRECT'
  | 'CODE_QUESTION_STARTED'
  | 'CODE_QUESTION_SUBMITTED'
  | 'CODE_QUESTION_PASSED'
  | 'CODE_QUESTION_FAILED';

export interface IUserActivityDocument extends Document {
  _id: Types.ObjectId;
  userId: string;
  courseId: Types.ObjectId;
  moduleId?: Types.ObjectId | null;
  submoduleId?: Types.ObjectId | null;
  eventType: UserActivityEventType;
  metadata: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userActivitySchema = new Schema<IUserActivityDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      default: null
    },
    submoduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Submodule',
      default: null
    },
    eventType: {
      type: String,
      required: true,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

userActivitySchema.index({ userId: 1, courseId: 1, timestamp: -1 });

const UserActivity = mongoose.model<IUserActivityDocument>('UserActivityLog', userActivitySchema);

export default UserActivity;
