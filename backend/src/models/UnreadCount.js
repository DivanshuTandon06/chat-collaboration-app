import mongoose from 'mongoose';

const unreadCountSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    count: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: false,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.conversationId?.toString) {
          ret.conversationId = ret.conversationId.toString();
        }
        if (ret.userId?.toString) {
          ret.userId = ret.userId.toString();
        }
      }
    }
  }
);

// Unique compound index — one entry per user per conversation
unreadCountSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

const UnreadCount = mongoose.model('UnreadCount', unreadCountSchema);

export default UnreadCount;
