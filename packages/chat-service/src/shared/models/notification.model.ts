import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType = 'mention' | 'reply' | 'announcement';

export interface INotification extends Document {
  userId: string;
  type: NotificationType;
  courseId: string;
  roomId: string;
  messageId: string;
  actorName: string;
  text: string;
  readAt: Date | null;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ['mention', 'reply', 'announcement'], required: true },
    courseId: { type: String, required: true },
    roomId: { type: String, required: true },
    messageId: { type: String, required: true },
    actorName: { type: String, default: '' },
    text: { type: String, default: '' },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);
NotificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model<INotification>('ChatNotification', NotificationSchema);
export default Notification;
