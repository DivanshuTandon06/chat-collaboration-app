import Message from '../models/Message.js';
import { userRepository } from './userRepository.js';

export const messageRepository = {
  async create({ conversationId, senderId, text }) {
    const sender = await userRepository.findById(senderId);

    const message = await Message.create({
      conversationId,
      senderId,
      text: text.trim(),
      isEdited: false,
      editedAt: null,
      isDeleted: false,
      deletedAt: null,
      readBy: [{ userId: senderId, readAt: new Date() }],
      reactions: []
    });

    const msgObj = message.toJSON();
    // Attach sender profile to match the existing API shape
    msgObj.sender = sender ? userRepository.sanitizeUser(sender) : { id: senderId };

    return msgObj;
  },

  async findById(id) {
    const msg = await Message.findById(id).lean();
    if (!msg) return null;
    return this._normalize(msg);
  },

  async findByConversationId(conversationId) {
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .lean();

    const result = [];
    for (const msg of messages) {
      const normalized = this._normalize(msg);
      // Attach sender profile
      const sender = await userRepository.findById(normalized.senderId);
      normalized.sender = sender ? userRepository.sanitizeUser(sender) : { id: normalized.senderId };
      result.push(normalized);
    }

    return result;
  },

  async update(id, { text }) {
    const msg = await Message.findByIdAndUpdate(
      id,
      {
        text: text.trim(),
        isEdited: true,
        editedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    ).lean();

    if (!msg) return null;
    return this._normalize(msg);
  },

  async delete(id) {
    const msg = await Message.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        text: 'This message was deleted',
        deletedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    ).lean();

    if (!msg) return null;
    return this._normalize(msg);
  },

  async markConversationMessagesRead(conversationId, readerId) {
    const now = new Date();

    // Find messages not sent by reader that reader hasn't read yet
    const unreadMessages = await Message.find({
      conversationId,
      senderId: { $ne: readerId },
      'readBy.userId': { $ne: readerId }
    }).lean();

    const updatedIds = [];

    if (unreadMessages.length > 0) {
      const ids = unreadMessages.map((m) => m._id);
      await Message.updateMany(
        { _id: { $in: ids } },
        { $push: { readBy: { userId: readerId, readAt: now } } }
      );
      updatedIds.push(...ids.map((id) => id.toString()));
    }

    return updatedIds;
  },

  async toggleReaction(id, { userId, username, emoji }) {
    const msg = await Message.findById(id);
    if (!msg || msg.isDeleted) return null;

    const existingIdx = msg.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingIdx !== -1) {
      msg.reactions.splice(existingIdx, 1);
    } else {
      msg.reactions.push({
        emoji,
        userId,
        username,
        createdAt: new Date()
      });
    }

    msg.updatedAt = new Date();
    await msg.save();

    return this._normalize(msg.toObject());
  },

  /**
   * Normalize a lean Mongoose document to match the shape controllers expect.
   */
  _normalize(doc) {
    const obj = { ...doc };
    obj.id = obj._id.toString();
    delete obj._id;
    delete obj.__v;

    if (obj.conversationId?.toString) {
      obj.conversationId = obj.conversationId.toString();
    }
    if (obj.senderId?.toString) {
      obj.senderId = obj.senderId.toString();
    }
    if (obj.readBy) {
      obj.readBy = obj.readBy.map((r) => ({
        ...r,
        userId: r.userId?.toString ? r.userId.toString() : r.userId
      }));
    }
    if (obj.reactions) {
      obj.reactions = obj.reactions.map((r) => ({
        ...r,
        userId: r.userId?.toString ? r.userId.toString() : r.userId
      }));
    }
    return obj;
  }
};
