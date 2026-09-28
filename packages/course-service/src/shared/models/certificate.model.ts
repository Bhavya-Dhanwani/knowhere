import mongoose, { Document, Schema, Types } from 'mongoose';

// An issued completion certificate. Names, title and signature are copied at issue time, so a
// later course rename or new signature never changes what a verifier sees.
export interface ICertificate extends Document {
  code: string;
  courseId: Types.ObjectId;
  userId: string;
  learnerName: string;
  courseTitle: string;
  signerName: string;
  signature: string;
  percentage: number;
  completedAt: Date;
  createdAt: Date;
}

const certificateSchema = new Schema<ICertificate>(
  {
    code: { type: String, required: true, unique: true },
    courseId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: String, required: true, index: true },
    learnerName: { type: String, required: true },
    courseTitle: { type: String, required: true },
    signerName: { type: String, required: true },
    signature: { type: String, required: true },
    percentage: { type: Number, required: true },
    completedAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// one certificate per learner per course
certificateSchema.index({ courseId: 1, userId: 1 }, { unique: true });

const Certificate = mongoose.model<ICertificate>('Certificate', certificateSchema);

export default Certificate;
