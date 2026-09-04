import { Schema, model, Document } from 'mongoose';

export type ResourceType = 'video' | 'notes';
export type ResourceStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface IResource extends Document {
  _id: any;
  title: string;
  type: ResourceType;
  ownerId: string;
  s3Key: string;
  playbackUrl?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  status: ResourceStatus;
  transcodingJobId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSchema = new Schema<IResource>(
  {
    title: {
      type: String,
      required: [true, 'Resource title is required'],
      trim: true
    },
    type: {
      type: String,
      enum: ['video', 'notes'],
      required: [true, 'Resource type is required']
    },
    ownerId: {
      type: String,
      required: [true, 'Owner ID is required'],
      index: true
    },
    s3Key: {
      type: String,
      required: [true, 'S3 key is required'],
      unique: true
    },
    playbackUrl: {
      type: String,
      default: null
    },
    durationSeconds: {
      type: Number,
      default: 0
    },
    fileSizeBytes: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed'],
      default: 'pending',
      index: true
    },
    transcodingJobId: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const Resource = model<IResource>('Resource', ResourceSchema);

export default Resource;
