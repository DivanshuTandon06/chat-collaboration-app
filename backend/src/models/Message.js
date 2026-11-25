import mongoose from 'mongoose';

const readReceiptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    emoji: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date,
      default: null
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    readBy: [readReceiptSchema],
    reactions: [reactionSchema]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.conversationId?.toString) {
          ret.conversationId = ret.conversationId.toString();
        }
        if (ret.senderId?.toString) {
          ret.senderId = ret.senderId.toString();
        }
        if (ret.readBy) {
          ret.readBy = ret.readBy.map((r) => ({
            ...r,
            userId: r.userId?.toString ? r.userId.toString() : r.userId
          }));
        }
        if (ret.reactions) {
          ret.reactions = ret.reactions.map((r) => ({
            ...r,
            userId: r.userId?.toString ? r.userId.toString() : r.userId
          }));
        }
      }
    },
    toObject: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.conversationId?.toString) {
          ret.conversationId = ret.conversationId.toString();
        }
        if (ret.senderId?.toString) {
          ret.senderId = ret.senderId.toString();
        }
        if (ret.readBy) {
          ret.readBy = ret.readBy.map((r) => ({
            ...r,
            userId: r.userId?.toString ? r.userId.toString() : r.userId
          }));
        }
        if (ret.reactions) {
          ret.reactions = ret.reactions.map((r) => ({
            ...r,
            userId: r.userId?.toString ? r.userId.toString() : r.userId
          }));
        }
      }
    }
  }
);

// Compound index for fetching messages by conversation sorted by time
messageSchema.index({ conversationId: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
