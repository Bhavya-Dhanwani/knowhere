import mongoose, { Document, Schema, Types } from 'mongoose';

export type SubmoduleContentType = 'video' | 'resource' | 'mcq' | 'code-question';

export interface ISubmoduleContentItem {
  _id?: Types.ObjectId;
  type: SubmoduleContentType;
  resourceId?: Types.ObjectId | null;
  contentId?: Types.ObjectId | null;
  order: number;
}

export interface ISubmoduleDocument extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  courseId?: Types.ObjectId | null;
  creatorId?: string;
  moduleId?: Types.ObjectId | null;
  order: number;
  content: ISubmoduleContentItem[];
  createdAt: Date;
  updatedAt: Date;
}

const submoduleContentItemSchema = new Schema<ISubmoduleContentItem>(
  {
    type: {
      type: String,
      enum: ['video', 'resource', 'mcq', 'code-question'],
      required: true
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      ref: 'CourseResource',
      default: null
    },
    contentId: {
      type: Schema.Types.ObjectId,
      default: null
    },
    order: {
      type: Number,
      required: true,
      default: 1
    }
  },
  // entries keep an _id: learner progress references them
  {}
);

const submoduleSchema = new Schema<ISubmoduleDocument>(
  {
    title: {
      type: String,
      required: [true, 'Submodule title is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true
    },
    creatorId: {
      type: String,
      default: null,
      index: true
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      default: null,
      index: true
    },
    order: {
      type: Number,
      required: [true, 'Order is required'],
      default: 1
    },
    content: {
      type: [submoduleContentItemSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

submoduleSchema.index({ courseId: 1, moduleId: 1, order: 1 });

const Submodule = mongoose.model<ISubmoduleDocument>('Submodule', submoduleSchema);

export default Submodule;
