
import mongoose from 'mongoose';
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
    msgObj.sender = sender
      ? userRepository.sanitizeUser(sender)
      : { id: senderId };

    return msgObj;
  },

  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;

    const msg = await Message.findById(id).lean();
    if (!msg) return null;

    return this._normalize(msg);
  },

  // Cursor-based pagination
  async findByConversationId(conversationId, { before, limit = 30 } = {}) {
    const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const filter = { conversationId };

    if (before && mongoose.isValidObjectId(before)) {
      const cursor = await Message.findOne({
        _id: before,
        conversationId
      }).select('createdAt');

      if (cursor) {
        filter.createdAt = { $lt: cursor.createdAt };
      }
    }

    const docs = await Message.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageSize + 1)
      .lean();

    const hasMore = docs.length > pageSize;

    const page = docs
      .slice(0, pageSize)
      .reverse()
      .map((msg) => this._normalize(msg));

    // Attach sender profiles
    for (const msg of page) {
      const sender = await userRepository.findById(msg.senderId);
      msg.sender = sender
        ? userRepository.sanitizeUser(sender)
        : { id: msg.senderId };
    }

    return {
      messages: page,
      hasMore,
      nextCursor: hasMore ? page[0]?.id : null
    };
  },

  async update(id, { text }) {
    if (!mongoose.isValidObjectId(id)) return null;

    const msg = await Message.findByIdAndUpdate(
      id,
      {
        $set: {
          text: text.trim(),
          isEdited: true,
          editedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    ).lean();

    if (!msg) return null;
    return this._normalize(msg);
  },

  async delete(id) {
    if (!mongoose.isValidObjectId(id)) return null;

    const msg = await Message.findByIdAndUpdate(
      id,
      {
        $set: {
          isDeleted: true,
          text: 'This message was deleted',
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { new: true }
    ).lean();

    if (!msg) return null;
    return this._normalize(msg);
  },

  async markConversationMessagesRead(conversationId, readerId) {
    const unread = await Message.find({
      conversationId,
      senderId: { $ne: readerId },
      'readBy.userId': { $ne: readerId }
    }).select('_id');

    if (!unread.length) return [];

    const ids = unread.map((msg) => msg._id);

    await Message.updateMany(
      { _id: { $in: ids } },
      {
        $push: {
          readBy: { userId: readerId, readAt: new Date() }
        }
      }
    );

    return ids.map((id) => id.toString());
  },

  async toggleReaction(id, { userId, username, emoji }) {
    if (!mongoose.isValidObjectId(id)) return null;

    const msg = await Message.findById(id);
    if (!msg || msg.isDeleted) return null;

    const existingIdx = msg.reactions.findIndex(
      (r) =>
        r.userId.toString() === userId.toString() &&
        r.emoji === emoji
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

  // Convert MongoDB ObjectIds into strings for API responses
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
        userId: r.userId?.toString
          ? r.userId.toString()
          : r.userId
      }));
    }

    if (obj.reactions) {
      obj.reactions = obj.reactions.map((r) => ({
        ...r,
        userId: r.userId?.toString
          ? r.userId.toString()
          : r.userId
      }));
    }

    return obj;
  }
};
