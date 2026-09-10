import ChatMessage, { IChatMessage } from '../models/message.model.js';

class ChatMessageDao {
  async createMessage(data: Partial<IChatMessage>): Promise<IChatMessage> {
    return await ChatMessage.create(data);
  }

  async findMessageById(id: string): Promise<IChatMessage | null> {
    return await ChatMessage.findById(id);
  }

  async getRoomMessages(
    roomId: string,
    limit: number = 50,
    beforeId?: string
  ): Promise<IChatMessage[]> {
    const query: Record<string, unknown> = {
      roomId,
      deletedAt: null
    };

    if (beforeId) {
      const beforeMsg = await ChatMessage.findById(beforeId);
      if (beforeMsg) {
        query.createdAt = { $lt: beforeMsg.createdAt };
      }
    }

    const messages = await ChatMessage.find(query).sort({ createdAt: -1 }).limit(limit);

    // Return in chronological order (oldest to newest)
    return messages.reverse();
  }

  async editMessage(
    messageId: string,
    userId: string,
    content: string
  ): Promise<IChatMessage | null> {
    const msg = await ChatMessage.findById(messageId);
    if (!msg || msg.sender.userId !== userId || msg.deletedAt) return null;

    msg.content = content;
    msg.isEdited = true;
    return await msg.save();
  }

  async deleteMessage(
    messageId: string,
    userId: string,
    isPrivileged: boolean = false
  ): Promise<IChatMessage | null> {
    const msg = await ChatMessage.findById(messageId);
    if (!msg) return null;

    if (msg.sender.userId !== userId && !isPrivileged) {
      return null;
    }

    msg.deletedAt = new Date();
    msg.content = '*(This message was deleted)*';
    return await msg.save();
  }

  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<IChatMessage | null> {
    const msg = await ChatMessage.findById(messageId);
    if (!msg || msg.deletedAt) return null;

    let reaction = msg.reactions.find((r) => r.emoji === emoji);

    if (!reaction) {
      reaction = { emoji, users: [userId], count: 1 };
      msg.reactions.push(reaction);
    } else {
      const userIndex = reaction.users.indexOf(userId);
      if (userIndex > -1) {
        reaction.users.splice(userIndex, 1);
        reaction.count -= 1;
        if (reaction.count <= 0) {
          msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
        }
      } else {
        reaction.users.push(userId);
        reaction.count += 1;
      }
    }

    return await msg.save();
  }

  async setPinnedStatus(messageId: string, isPinned: boolean): Promise<IChatMessage | null> {
    return await ChatMessage.findByIdAndUpdate(messageId, { isPinned }, { new: true });
  }

  async getPinnedMessages(roomId: string): Promise<IChatMessage[]> {
    return await ChatMessage.find({ roomId, isPinned: true, deletedAt: null }).sort({
      createdAt: -1
    });
  }
}

export default ChatMessageDao;
