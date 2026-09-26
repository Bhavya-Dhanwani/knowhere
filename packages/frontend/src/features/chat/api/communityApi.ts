import { axiosClient } from '../../../shared/lib/axiosClient';
import { apiErrorMessage } from '../../../shared/lib/roles';

export type ChannelKind = 'text' | 'announcement' | 'voice';

export interface Channel {
  _id: string;
  name: string;
  description: string;
  kind: ChannelKind;
  visibility: 'public' | 'private';
  courseId: string;
  members: { userId: string; role: string }[];
  unread: number;
  lastMessage?: { content: string; senderName: string; createdAt: string };
}

export interface Attachment {
  url: string;
  type: 'image' | 'video' | 'file' | 'code';
  name: string;
  sizeBytes?: number;
}

export interface Message {
  _id: string;
  roomId: string;
  sender: { userId: string; name: string; role?: string };
  content: string;
  attachments: Attachment[];
  mentions: string[];
  replyTo?: { messageId: string; senderName: string; snippet: string };
  replyCount: number;
  reactions: { emoji: string; users: string[]; count: number }[];
  isPinned: boolean;
  isEdited: boolean;
  deletedAt?: string | null;
  createdAt: string;
}

export interface Member {
  userId: string;
  name: string;
  avatar: string;
  bio: string;
  role: 'admin' | 'trainer' | 'trainee';
  online: boolean;
}

export interface Access {
  courseId: string;
  role: 'admin' | 'trainer' | 'trainee';
  moderator: boolean;
}

export interface AppNotification {
  _id: string;
  type: 'mention' | 'reply' | 'announcement';
  courseId: string;
  roomId: string;
  messageId: string;
  actorName: string;
  text: string;
  readAt: string | null;
  createdAt: string;
}

const data = <T>(res: { data?: { data?: T } }): T => res.data?.data as T;
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
}

export const communityApi = {
  community: (courseId: string) =>
    call(async () =>
      data<{ access: Access; channels: Channel[]; onlineUserIds: string[] }>(
        await axiosClient.get(`/chat/communities/${courseId}`)
      )
    ),
  members: (courseId: string) =>
    call(async () =>
      data<Member[]>(await axiosClient.get(`/chat/communities/${courseId}/members`))
    ),
  search: (courseId: string, q: string) =>
    call(async () =>
      data<Message[]>(
        await axiosClient.get(`/chat/communities/${courseId}/search`, { params: { q } })
      )
    ),
  messages: (roomId: string, before?: string) =>
    call(async () =>
      data<Message[]>(
        await axiosClient.get(`/chat/channels/${roomId}/messages`, { params: { before } })
      )
    ),
  thread: (messageId: string) =>
    call(async () =>
      data<{ root: Message; replies: Message[] }>(
        await axiosClient.get(`/chat/messages/${messageId}/thread`)
      )
    ),
  markRead: (roomId: string) =>
    call(async () => void (await axiosClient.post(`/chat/channels/${roomId}/read`))),

  createChannel: (
    courseId: string,
    input: {
      name: string;
      description?: string;
      kind: ChannelKind;
      visibility: 'public' | 'private';
      memberIds?: string[];
    }
  ) =>
    call(async () =>
      data<Channel>(await axiosClient.post(`/chat/communities/${courseId}/channels`, input))
    ),
  updateChannel: (
    id: string,
    input: Partial<{ name: string; description: string; visibility: 'public' | 'private' }>
  ) => call(async () => data<Channel>(await axiosClient.put(`/chat/channels/${id}`, input))),
  deleteChannel: (id: string) =>
    call(async () => void (await axiosClient.delete(`/chat/channels/${id}`))),
  addChannelMember: (id: string, userId: string) =>
    call(async () => void (await axiosClient.post(`/chat/channels/${id}/members`, { userId }))),
  removeChannelMember: (id: string, userId: string) =>
    call(async () => void (await axiosClient.delete(`/chat/channels/${id}/members/${userId}`))),

  editMessage: (id: string, content: string) =>
    call(async () => data<Message>(await axiosClient.put(`/chat/messages/${id}`, { content }))),
  deleteMessage: (id: string) =>
    call(async () => void (await axiosClient.delete(`/chat/messages/${id}`))),
  react: (id: string, emoji: string) =>
    call(async () =>
      data<Message>(await axiosClient.post(`/chat/messages/${id}/react`, { emoji }))
    ),
  pin: (id: string) =>
    call(async () => data<Message>(await axiosClient.post(`/chat/messages/${id}/pin`))),

  upload: (courseId: string, file: File) =>
    call(async () =>
      data<Attachment>(
        await axiosClient.post(`/chat/communities/${courseId}/files`, file, {
          params: { name: file.name },
          headers: { 'Content-Type': file.type || 'application/octet-stream' }
        })
      )
    ),
  // files need the bearer token, so they are loaded as blobs
  fileBlobUrl: (url: string) =>
    call(async () =>
      URL.createObjectURL(
        (await axiosClient.get(url.replace(/^\/api/, ''), { responseType: 'blob' })).data
      )
    ),

  notifications: () =>
    call(async () =>
      data<{ items: AppNotification[]; unread: number }>(
        await axiosClient.get('/chat/notifications')
      )
    ),
  readNotifications: (ids?: string[]) =>
    call(async () => void (await axiosClient.post('/chat/notifications/read', ids ? { ids } : {}))),
  // LiveKit URL + access token scoped to one voice channel
  voiceToken: (roomId: string) =>
    call(async () =>
      data<{ url: string; token: string }>(
        await axiosClient.post(`/chat/channels/${roomId}/voice-token`)
      )
    )
};
