import mongoose, { Schema, Document } from 'mongoose';

export type RoomType = 'course' | 'public' | 'private_group' | 'direct';

export interface IRoomMember {
  userId: string;
  role: 'owner' | 'moderator' | 'member';
  joinedAt: Date;
  lastReadAt: Date;
}

export interface IChatRoom extends Document {
  _id: any;
  name: string;
  slug: string;
  description: string;
  type: RoomType;
  courseId?: string;
  icon?: string;
  creatorId: string;
  members: IRoomMember[];
  isArchived: boolean;
  pinnedMessageIds: string[];
  lastMessage?: {
    messageId: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const RoomMemberSchema = new Schema<IRoomMember>(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ['owner', 'moderator', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ChatRoomSchema = new Schema<IChatRoom>(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      minlength: [2, 'Room name must be at least 2 characters long']
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    type: {
      type: String,
      enum: ['course', 'public', 'private_group', 'direct'],
      default: 'public',
      index: true
    },
    courseId: {
      type: String,
      index: true,
      default: null
    },
    icon: {
      type: String,
      default: ''
    },
    creatorId: {
      type: String,
      required: true,
      index: true
    },
    members: {
      type: [RoomMemberSchema],
      default: []
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    pinnedMessageIds: {
      type: [String],
      default: []
    },
    lastMessage: {
      messageId: String,
      content: String,
      senderId: String,
      senderName: String,
      createdAt: Date
    }
  },
  {
    timestamps: true
  }
);

ChatRoomSchema.index({ 'members.userId': 1 });

const ChatRoom = mongoose.model<IChatRoom>('ChatRoom', ChatRoomSchema);

export default ChatRoom;
