import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const lastMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    text: String,
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    senderName: String,
    createdAt: Date
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true
    },
    name: {
      type: String,
      trim: true,
      default: null
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    participants: [participantSchema],
    lastMessage: {
      type: lastMessageSchema,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        // Transform participant userIds to strings
        if (ret.participants) {
          ret.participants = ret.participants.map((p) => ({
            ...p,
            userId: p.userId?.toString ? p.userId.toString() : p.userId
          }));
        }
        if (ret.createdBy?.toString) {
          ret.createdBy = ret.createdBy.toString();
        }
        if (ret.lastMessage) {
          if (ret.lastMessage.messageId?.toString) {
            ret.lastMessage.id = ret.lastMessage.messageId.toString();
            delete ret.lastMessage.messageId;
          }
          if (ret.lastMessage.senderId?.toString) {
            ret.lastMessage.senderId = ret.lastMessage.senderId.toString();
          }
        }
      }
    },
    toObject: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.participants) {
          ret.participants = ret.participants.map((p) => ({
            ...p,
            userId: p.userId?.toString ? p.userId.toString() : p.userId
          }));
        }
        if (ret.createdBy?.toString) {
          ret.createdBy = ret.createdBy.toString();
        }
        if (ret.lastMessage) {
          if (ret.lastMessage.messageId?.toString) {
            ret.lastMessage.id = ret.lastMessage.messageId.toString();
            delete ret.lastMessage.messageId;
          }
          if (ret.lastMessage.senderId?.toString) {
            ret.lastMessage.senderId = ret.lastMessage.senderId.toString();
          }
        }
      }
    }
  }
);

// Index for finding conversations a user participates in
conversationSchema.index({ 'participants.userId': 1 });
// Index for finding direct conversations between two users
conversationSchema.index({ type: 1, 'participants.userId': 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
