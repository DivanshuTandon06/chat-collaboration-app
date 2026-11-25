import Conversation from '../models/Conversation.js';
import UnreadCount from '../models/UnreadCount.js';
import { userRepository } from './userRepository.js';

export const conversationRepository = {
  async findById(id) {
    const conv = await Conversation.findById(id).lean();
    if (!conv) return null;
    return this._normalize(conv);
  },

  async findDirect(user1Id, user2Id) {
    const conv = await Conversation.findOne({
      type: 'direct',
      'participants.userId': { $all: [user1Id, user2Id] },
      participants: { $size: 2 }
    }).lean();

    if (!conv) return null;
    return this._normalize(conv);
  },

  async createDirect(user1Id, user2Id) {
    const existing = await this.findDirect(user1Id, user2Id);
    if (existing) return existing;

    const now = new Date();
    const conv = await Conversation.create({
      type: 'direct',
      name: null,
      description: null,
      createdBy: user1Id,
      participants: [
        { userId: user1Id, role: 'member', joinedAt: now },
        { userId: user2Id, role: 'member', joinedAt: now }
      ],
      lastMessage: null
    });

    // Initialize unread counts
    await UnreadCount.insertMany([
      { conversationId: conv._id, userId: user1Id, count: 0 },
      { conversationId: conv._id, userId: user2Id, count: 0 }
    ]);

    return this._normalize(conv.toObject());
  },

  async createGroup({ name, description = '', createdById, participantIds = [] }) {
    const now = new Date();
    const uniqueIds = Array.from(new Set([createdById, ...participantIds]));

    const participants = uniqueIds.map((userId) => ({
      userId,
      role: userId === createdById ? 'admin' : 'member',
      joinedAt: now
    }));

    const conv = await Conversation.create({
      type: 'group',
      name: name.trim(),
      description: description ? description.trim() : '',
      createdBy: createdById,
      participants,
      lastMessage: null
    });

    // Initialize unread counts for all members
    await UnreadCount.insertMany(
      uniqueIds.map((userId) => ({
        conversationId: conv._id,
        userId,
        count: 0
      }))
    );

    return this._normalize(conv.toObject());
  },

  async findByUserId(userId) {
    const conversations = await Conversation.find({
      'participants.userId': userId
    }).lean();

    const enrichedList = [];
    for (const conv of conversations) {
      const normalized = this._normalize(conv);
      const enriched = await this.enrichConversation(normalized, userId);
      enrichedList.push(enriched);
    }

    // Sort: most recent message or update first
    enrichedList.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(a.updatedAt);
      const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(b.updatedAt);
      return timeB - timeA;
    });

    return enrichedList;
  },

  async isMember(conversationId, userId) {
    const conv = await Conversation.findOne({
      _id: conversationId,
      'participants.userId': userId
    }).lean();
    return !!conv;
  },

  async addMember(conversationId, userId, role = 'member') {
    const conv = await Conversation.findById(conversationId);
    if (!conv || conv.type !== 'group') return null;

    const alreadyMember = conv.participants.some(
      (p) => p.userId.toString() === userId.toString()
    );

    if (!alreadyMember) {
      conv.participants.push({
        userId,
        role,
        joinedAt: new Date()
      });
      conv.updatedAt = new Date();
      await conv.save();

      // Initialize unread count for new member
      await UnreadCount.findOneAndUpdate(
        { conversationId, userId },
        { $setOnInsert: { count: 0 } },
        { upsert: true }
      );
    }

    return this._normalize(conv.toObject());
  },

  async removeMember(conversationId, userId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv || conv.type !== 'group') return null;

    conv.participants = conv.participants.filter(
      (p) => p.userId.toString() !== userId.toString()
    );
    conv.updatedAt = new Date();
    await conv.save();

    // Remove unread count entry for removed member
    await UnreadCount.deleteOne({ conversationId, userId });

    return this._normalize(conv.toObject());
  },

  async update(conversationId, data) {
    const updateFields = {};
    if (data.name !== undefined) updateFields.name = data.name.trim();
    if (data.description !== undefined) updateFields.description = data.description.trim();
    updateFields.updatedAt = new Date();

    const conv = await Conversation.findByIdAndUpdate(
      conversationId,
      updateFields,
      { new: true }
    ).lean();

    if (!conv) return null;
    return this._normalize(conv);
  },

  async setLastMessage(conversationId, messageSummary) {
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        messageId: messageSummary.id,
        text: messageSummary.text,
        senderId: messageSummary.senderId,
        senderName: messageSummary.senderName,
        createdAt: messageSummary.createdAt
      },
      updatedAt: new Date()
    });
  },

  async getUnreadCount(conversationId, userId) {
    const doc = await UnreadCount.findOne({ conversationId, userId }).lean();
    return doc ? doc.count : 0;
  },

  async incrementUnread(conversationId, excludeUserId) {
    const conv = await Conversation.findById(conversationId).lean();
    if (!conv) return;

    const otherUserIds = conv.participants
      .filter((p) => p.userId.toString() !== excludeUserId.toString())
      .map((p) => p.userId);

    if (otherUserIds.length > 0) {
      await UnreadCount.updateMany(
        { conversationId, userId: { $in: otherUserIds } },
        { $inc: { count: 1 } }
      );
    }
  },

  async resetUnread(conversationId, userId) {
    await UnreadCount.findOneAndUpdate(
      { conversationId, userId },
      { count: 0 },
      { upsert: true }
    );
  },

  async enrichConversation(conv, currentUserId) {
    const copy = JSON.parse(JSON.stringify(conv));
    copy.unreadCount = await this.getUnreadCount(conv.id, currentUserId);

    // Attach full participant profiles
    const detailedParticipants = [];
    for (const p of copy.participants) {
      const user = await userRepository.findById(p.userId);
      if (user) {
        detailedParticipants.push({
          ...userRepository.sanitizeUser(user),
          role: p.role,
          joinedAt: p.joinedAt
        });
      }
    }
    copy.participants = detailedParticipants;

    // For direct conversations, calculate display name
    if (copy.type === 'direct') {
      const other =
        detailedParticipants.find((p) => p.id !== currentUserId.toString()) ||
        detailedParticipants[0];
      copy.displayName = other ? other.fullName || other.username : 'Chat';
      copy.otherUser = other || null;
    } else {
      copy.displayName = copy.name;
    }

    return copy;
  },

  async delete(conversationId) {
    const conv = await Conversation.findById(conversationId).lean();
    if (!conv) return false;

    // Import Message model dynamically to avoid circular dependency
    const { default: Message } = await import('../models/Message.js');

    // Delete all messages for this conversation
    await Message.deleteMany({ conversationId });

    // Delete all unread count entries
    await UnreadCount.deleteMany({ conversationId });

    // Delete the conversation itself
    await Conversation.findByIdAndDelete(conversationId);

    return true;
  },

  /**
   * Normalize a lean Mongoose document to match the shape controllers expect.
   */
  _normalize(doc) {
    const obj = { ...doc };
    obj.id = obj._id.toString();
    delete obj._id;
    delete obj.__v;

    if (obj.createdBy?.toString) {
      obj.createdBy = obj.createdBy.toString();
    }
    if (obj.participants) {
      obj.participants = obj.participants.map((p) => ({
        ...p,
        userId: p.userId?.toString ? p.userId.toString() : p.userId
      }));
    }
    if (obj.lastMessage) {
      if (obj.lastMessage.messageId?.toString) {
        obj.lastMessage.id = obj.lastMessage.messageId.toString();
        delete obj.lastMessage.messageId;
      }
      if (obj.lastMessage.senderId?.toString) {
        obj.lastMessage.senderId = obj.lastMessage.senderId.toString();
      }
    }
    return obj;
  }
};
