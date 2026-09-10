import ChatRoom, { IChatRoom } from '../models/room.model.js';

class ChatRoomDao {
  async createRoom(data: Partial<IChatRoom>): Promise<IChatRoom> {
    return await ChatRoom.create(data);
  }

  async findRoomById(id: string): Promise<IChatRoom | null> {
    return await ChatRoom.findById(id);
  }

  async findRoomBySlug(slug: string): Promise<IChatRoom | null> {
    return await ChatRoom.findOne({ slug });
  }

  async findRooms(filters: {
    userId?: string;
    courseId?: string;
    type?: string;
  }): Promise<IChatRoom[]> {
    const query: Record<string, unknown> = { isArchived: false };

    if (filters.courseId) {
      query.courseId = filters.courseId;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.userId) {
      // Find rooms where user is a member OR public/course rooms
      query.$or = [
        { type: { $in: ['public', 'course'] } },
        { 'members.userId': filters.userId },
        { creatorId: filters.userId }
      ];
    }

    return await ChatRoom.find(query).sort({ updatedAt: -1 });
  }

  async addMember(
    roomId: string,
    userId: string,
    role: 'owner' | 'moderator' | 'member' = 'member'
  ): Promise<IChatRoom | null> {
    const room = await ChatRoom.findById(roomId);
    if (!room) return null;

    const exists = room.members.some((m) => m.userId === userId);
    if (!exists) {
      room.members.push({
        userId,
        role,
        joinedAt: new Date(),
        lastReadAt: new Date()
      });
      await room.save();
    }
    return room;
  }

  async removeMember(roomId: string, userId: string): Promise<IChatRoom | null> {
    return await ChatRoom.findByIdAndUpdate(
      roomId,
      { $pull: { members: { userId } } },
      { new: true }
    );
  }

  async updateLastMessage(
    roomId: string,
    lastMessage: {
      messageId: string;
      content: string;
      senderId: string;
      senderName: string;
      createdAt: Date;
    }
  ): Promise<void> {
    await ChatRoom.findByIdAndUpdate(roomId, { lastMessage, updatedAt: new Date() });
  }

  async updateRoom(roomId: string, data: Partial<IChatRoom>): Promise<IChatRoom | null> {
    return await ChatRoom.findByIdAndUpdate(roomId, data, { new: true });
  }

  async deleteRoom(roomId: string): Promise<IChatRoom | null> {
    return await ChatRoom.findByIdAndUpdate(roomId, { isArchived: true }, { new: true });
  }

  async togglePinMessage(
    roomId: string,
    messageId: string
  ): Promise<{ room: IChatRoom | null; isPinned: boolean }> {
    const room = await ChatRoom.findById(roomId);
    if (!room) return { room: null, isPinned: false };

    const index = room.pinnedMessageIds.indexOf(messageId);
    let isPinned = false;
    if (index > -1) {
      room.pinnedMessageIds.splice(index, 1);
      isPinned = false;
    } else {
      room.pinnedMessageIds.push(messageId);
      isPinned = true;
    }
    await room.save();
    return { room, isPinned };
  }
}

export default ChatRoomDao;
