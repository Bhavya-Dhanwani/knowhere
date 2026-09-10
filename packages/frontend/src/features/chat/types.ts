export type RoomType = 'course' | 'public' | 'private_group' | 'direct';

export interface RoomMember {
  userId: string;
  role: 'owner' | 'moderator' | 'member';
  joinedAt: string;
  lastReadAt: string;
}

export interface ChatRoom {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  type: RoomType;
  courseId?: string;
  icon?: string;
  creatorId: string;
  members: RoomMember[];
  isArchived: boolean;
  pinnedMessageIds?: string[];
  lastMessage?: {
    messageId: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface Attachment {
  url: string;
  type: 'image' | 'video' | 'file' | 'code';
  name: string;
  sizeBytes?: number;
}

export interface ChatMessage {
  _id: string;
  roomId: string;
  sender: {
    userId: string;
    name: string;
    avatar?: string;
    role?: string;
  };
  content: string;
  attachments?: Attachment[];
  replyTo?: {
    messageId: string;
    senderName: string;
    snippet: string;
  };
  reactions: Reaction[];
  isPinned?: boolean;
  isEdited?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserTypingEvent {
  roomId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}
