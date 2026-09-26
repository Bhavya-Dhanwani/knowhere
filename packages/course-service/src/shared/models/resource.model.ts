import mongoose, { Document, Schema, Types } from 'mongoose';

export type EducationalResourceType = 'video' | 'pdf' | 'docx' | 'xlsx' | 'image' | 'resource';

export type ResourceUploadStatus =
  'PENDING_UPLOAD' | 'UPLOADING' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETED';

export type VideoDrmStatus = 'DRM_PENDING' | 'DRM_PROCESSING' | 'DRM_READY' | 'DRM_FAILED';

export interface IResourceDocument extends Document {
  _id: Types.ObjectId;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  resourceType: EducationalResourceType;
  courseId?: Types.ObjectId | null;
  submoduleId?: Types.ObjectId | null;
  ownerId: string;
  s3Key: string;
  playbackUrl?: string | null;
  durationSeconds?: number;
  status: ResourceUploadStatus;
  drmStatus?: VideoDrmStatus;
  drmManifestUrl?: string | null;
  hlsKey?: string | null;
  hlsIv?: string | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const resourceSchema = new Schema<IResourceDocument>(
  {
    fileName: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true
    },
    fileSizeBytes: {
      type: Number,
      required: [true, 'File size in bytes is required'],
      min: [1, 'File size must be greater than 0']
    },
    resourceType: {
      type: String,
      enum: ['video', 'pdf', 'docx', 'xlsx', 'image', 'resource'],
      required: [true, 'Resource type is required']
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true
    },
    submoduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Submodule',
      default: null,
      index: true
    },
    ownerId: {
      type: String,
      required: [true, 'Owner user ID is required'],
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
    status: {
      type: String,
      enum: ['PENDING_UPLOAD', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'DELETED'],
      default: 'PENDING_UPLOAD',
      index: true
    },
    drmStatus: {
      type: String,
      enum: ['DRM_PENDING', 'DRM_PROCESSING', 'DRM_READY', 'DRM_FAILED'],
      default: undefined
    },
    drmManifestUrl: {
      type: String,
      default: null
    },
    // AES-128 key/IV of the encrypted HLS rendition; served only by the key endpoint
    hlsKey: { type: String, default: null, select: false },
    hlsIv: { type: String, default: null },
    failureReason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

resourceSchema.index({ courseId: 1, resourceType: 1 });

const Resource = mongoose.model<IResourceDocument>('CourseResource', resourceSchema);

export default Resource;
