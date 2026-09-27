import mongoose, { Document, Schema } from 'mongoose';

// One embedded chunk for the AI coach's retrieval: a learner's behaviour (userId set) or a piece
// of course content (userId null). Re-embedded only when its text changes (hash).
export interface ICoachDocument extends Document {
  key: string;
  courseId: string;
  userId: string | null;
  kind: string;
  itemId?: string | null;
  title: string;
  text: string;
  hash: string;
  embedding: number[];
  updatedAt: Date;
}

const coachDocumentSchema = new Schema<ICoachDocument>(
  {
    key: { type: String, required: true, unique: true },
    courseId: { type: String, required: true },
    userId: { type: String, default: null },
    kind: { type: String, required: true },
    itemId: { type: String, default: null },
    title: { type: String, required: true },
    text: { type: String, required: true },
    hash: { type: String, required: true },
    embedding: { type: [Number], default: [] }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

coachDocumentSchema.index({ courseId: 1, userId: 1 });

const CoachDocument = mongoose.model<ICoachDocument>('CourseCoachDocument', coachDocumentSchema);
export default CoachDocument;
