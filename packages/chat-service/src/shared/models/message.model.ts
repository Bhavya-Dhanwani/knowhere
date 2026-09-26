import mongoose, { Schema, Document } from 'mongoose';

export interface IReaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface IAttachment {
  url: string;
  type: 'image' | 'video' | 'file' | 'code';
  name: string;
  sizeBytes?: number;
}

export interface IChatMessage extends Document {
  _id: any;
  roomId: string;
  sender: {
    userId: string;
    name: string;
    avatar?: string;
    role?: string;
  };
  content: string;
  attachments: IAttachment[];
  replyTo?: {
    messageId: string;
    senderName: string;
    snippet: string;
  };
  reactions: IReaction[];
  // user ids mentioned with @; they get a notification
  mentions: string[];
  // replies pointing at this message (thread size)
  replyCount: number;
  isPinned: boolean;
  isEdited: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReactionSchema = new Schema<IReaction>(
  {
    emoji: { type: String, required: true },
    users: { type: [String], default: [] },
    count: { type: Number, default: 0 }
  },
  { _id: false }
);

const AttachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video', 'file', 'code'], default: 'file' },
    name: { type: String, required: true },
    sizeBytes: { type: Number }
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    roomId: {
      type: String,
      required: [true, 'Room ID is required'],
      index: true
    },
    sender: {
      userId: { type: String, required: true, index: true },
      name: { type: String, required: true },
      avatar: { type: String, default: '' },
      role: { type: String, default: 'trainee' }
    },
    // may be empty when the message only carries attachments
    content: {
      type: String,
      default: '',
      trim: true
    },
    attachments: {
      type: [AttachmentSchema],
      default: []
    },
    replyTo: {
      messageId: String,
      senderName: String,
      snippet: String
    },
    reactions: {
      type: [ReactionSchema],
      default: []
    },
    mentions: {
      type: [String],
      default: [],
      index: true
    },
    replyCount: {
      type: Number,
      default: 0
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

ChatMessageSchema.index({ roomId: 1, createdAt: -1 });
ChatMessageSchema.index({ 'replyTo.messageId': 1, createdAt: 1 });
ChatMessageSchema.index({ content: 'text' });

const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);

export default ChatMessage;
