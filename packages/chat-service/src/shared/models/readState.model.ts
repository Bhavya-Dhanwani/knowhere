import mongoose, { Schema, Document } from 'mongoose';

// when a user last read a channel; unread = messages newer than this
export interface IReadState extends Document {
  userId: string;
  roomId: string;
  lastReadAt: Date;
}

const ReadStateSchema = new Schema<IReadState>({
  userId: { type: String, required: true },
  roomId: { type: String, required: true },
  lastReadAt: { type: Date, default: () => new Date(0) }
});
ReadStateSchema.index({ userId: 1, roomId: 1 }, { unique: true });

const ReadState = mongoose.model<IReadState>('ChatReadState', ReadStateSchema);
export default ReadState;
