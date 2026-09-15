import { axiosClient } from '../../../shared/lib/axiosClient';
import { ChatRoom, ChatMessage } from '../types';

export const chatApi = {
  getRooms: async (courseId?: string): Promise<ChatRoom[]> => {
    const params = courseId ? { courseId } : {};
    const res = await axiosClient.get('/chat/rooms', { params });
    return res.data?.data || res.data || [];
  },

  createRoom: async (data: {
    name: string;
    description?: string;
    type?: 'public' | 'course' | 'private_group';
    courseId?: string;
    icon?: string;
  }): Promise<ChatRoom> => {
    const res = await axiosClient.post('/chat/rooms', data);
    return res.data?.data || res.data;
  },

  getRoom: async (roomId: string): Promise<{ room: ChatRoom; onlineUsers: string[] }> => {
    const res = await axiosClient.get(`/chat/rooms/${roomId}`);
    return res.data?.data || res.data;
  },

  updateRoom: async (roomId: string, data: Partial<ChatRoom>): Promise<ChatRoom> => {
    const res = await axiosClient.put(`/chat/rooms/${roomId}`, data);
    return res.data?.data || res.data;
  },

  deleteRoom: async (roomId: string): Promise<void> => {
    await axiosClient.delete(`/chat/rooms/${roomId}`);
  },

  joinRoom: async (roomId: string): Promise<ChatRoom> => {
    const res = await axiosClient.post(`/chat/rooms/${roomId}/join`);
    return res.data?.data || res.data;
  },

  leaveRoom: async (roomId: string): Promise<ChatRoom> => {
    const res = await axiosClient.post(`/chat/rooms/${roomId}/leave`);
    return res.data?.data || res.data;
  },

  getMessages: async (roomId: string, limit = 50, beforeId?: string): Promise<ChatMessage[]> => {
    const params: Record<string, unknown> = { limit };
    if (beforeId) params.beforeId = beforeId;
    const res = await axiosClient.get(`/chat/rooms/${roomId}/messages`, { params });
    return res.data?.data || res.data || [];
  },

  sendMessage: async (
    roomId: string,
    data: {
      content: string;
      attachments?: any[];
      replyTo?: { messageId: string; senderName: string; snippet: string };
    }
  ): Promise<ChatMessage> => {
    const res = await axiosClient.post(`/chat/rooms/${roomId}/messages`, data);
    return res.data?.data || res.data;
  },

  toggleReaction: async (messageId: string, emoji: string): Promise<ChatMessage> => {
    const res = await axiosClient.post(`/chat/messages/${messageId}/react`, { emoji });
    return res.data?.data || res.data;
  },

  editMessage: async (messageId: string, content: string): Promise<ChatMessage> => {
    const res = await axiosClient.put(`/chat/messages/${messageId}`, { content });
    return res.data?.data || res.data;
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await axiosClient.delete(`/chat/messages/${messageId}`);
  }
};
