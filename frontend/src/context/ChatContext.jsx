
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react';

import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(
    () => localStorage.getItem('chat_active_conv_id') || null
  );

  const [messages, setMessages] = useState({});
  const [messagePages, setMessagePages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const activeIdRef = useRef(activeConversationId);
  const typingTimeoutRef = useRef(null);

  activeIdRef.current = activeConversationId;

  // 1. Fetch Messages
  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;

    setIsLoadingMessages(true);

    try {
      const data = await api.get(
        `/api/conversations/${conversationId}/messages`
      );

      setMessages((prev) => ({
        ...prev,
        [conversationId]: data.messages || []
      }));
      setMessagePages((prev) => ({ ...prev, [conversationId]: { hasMore: data.hasMore, nextCursor: data.nextCursor } }));
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const loadOlderMessages = useCallback(async (conversationId) => {
    const page = messagePages[conversationId];
    if (!page?.hasMore || !page.nextCursor || isLoadingMessages) return;
    setIsLoadingMessages(true);
    try {
      const data = await api.get(`/api/conversations/${conversationId}/messages?before=${encodeURIComponent(page.nextCursor)}`);
      setMessages((prev) => ({ ...prev, [conversationId]: [...(data.messages || []), ...(prev[conversationId] || [])] }));
      setMessagePages((prev) => ({ ...prev, [conversationId]: { hasMore: data.hasMore, nextCursor: data.nextCursor } }));
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [messagePages, isLoadingMessages]);

  // 2. Fetch Conversations
  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoadingConversations(true);

    try {
      const data = await api.get('/api/conversations');
      const list = data.conversations || [];

      setConversations(list);

      const savedActiveId = localStorage.getItem('chat_active_conv_id');

      if (savedActiveId && list.some((c) => c.id === savedActiveId)) {
        await fetchMessages(savedActiveId);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [isAuthenticated, fetchMessages]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 3. Select Conversation
  const selectConversation = useCallback(
    async (convId) => {
      setActiveConversationId(convId);

      if (!convId) {
        localStorage.removeItem('chat_active_conv_id');
        return;
      }

      localStorage.setItem('chat_active_conv_id', convId);

      if (socket) {
        socket.emit('conversation:join', {
          conversationId: convId
        });
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, unreadCount: 0 } : c
        )
      );

      try {
        await api.post(`/api/conversations/${convId}/read`);
      } catch (err) {
        console.warn('Error marking read:', err);
      }

      await fetchMessages(convId);
    },
    [socket, fetchMessages]
  );

  // 4. Start Typing
  const startTyping = useCallback(
    (convId) => {
      const targetId = convId || activeIdRef.current;

      if (!socket || !targetId) return;

      socket.emit('typing:start', {
        conversationId: targetId
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', {
          conversationId: targetId
        });
      }, 2500);
    },
    [socket]
  );

  // 5. Stop Typing
  const stopTyping = useCallback(
    (convId) => {
      const targetId = convId || activeIdRef.current;

      if (!socket || !targetId) return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      socket.emit('typing:stop', {
        conversationId: targetId
      });
    },
    [socket]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // 6. Send Message
  const sendMessage = async (text) => {
    if (!activeConversationId || !text.trim()) return null;

    try {
      const data = await api.post(
        `/api/conversations/${activeConversationId}/messages`,
        { text: text.trim() }
      );

      stopTyping(activeConversationId);

      return data.message;
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  };

  // 7. Edit Message
  const editMessage = async (messageId, newText) => {
    try {
      const data = await api.put(`/api/messages/${messageId}`, {
        text: newText.trim()
      });

      return data.message;
    } catch (err) {
      console.error('Error editing message:', err);
      throw err;
    }
  };

  // 8. Delete Message
  const deleteMessage = async (messageId) => {
    try {
      const data = await api.delete(`/api/messages/${messageId}`);
      return data.message;
    } catch (err) {
      console.error('Error deleting message:', err);
      throw err;
    }
  };

  // 9. Toggle Reaction
  const toggleReaction = async (messageId, emoji) => {
    try {
      const data = await api.post(
        `/api/messages/${messageId}/reactions`,
        { emoji }
      );

      return data.message;
    } catch (err) {
      console.error('Error toggling reaction:', err);
      throw err;
    }
  };

  // 10. Create Direct Chat
  const createDirectChat = async (recipientId) => {
    try {
      const data = await api.post('/api/conversations/direct', {
        recipientId
      });

      const conv = data.conversation;

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);

        if (exists) {
          return prev.map((c) =>
            c.id === conv.id ? conv : c
          );
        }

        return [conv, ...prev];
      });

      await selectConversation(conv.id);

      return conv;
    } catch (err) {
      console.error('Error creating direct chat:', err);
      throw err;
    }
  };

  // 11. Create Group Chat
  const createGroupChat = async ({
    name,
    description,
    participantIds
  }) => {
    try {
      const data = await api.post('/api/conversations/group', {
        name,
        description,
        participantIds
      });

      const conv = data.conversation;

      setConversations((prev) => [conv, ...prev]);

      await selectConversation(conv.id);

      return conv;
    } catch (err) {
      console.error('Error creating group chat:', err);
      throw err;
    }
  };

  // 12. Update Group Information
  const updateGroupInfo = async (conversationId, updateData) => {
    try {
      const data = await api.put(
        `/api/conversations/${conversationId}`,
        updateData
      );

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? data.conversation : c
        )
      );

      return data.conversation;
    } catch (err) {
      console.error('Error updating group info:', err);
      throw err;
    }
  };

  // 13. Add Group Member
  const addGroupMember = async (conversationId, userId) => {
    try {
      const data = await api.post(
        `/api/conversations/${conversationId}/members`,
        { userId }
      );

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? data.conversation : c
        )
      );

      return data.conversation;
    } catch (err) {
      console.error('Error adding group member:', err);
      throw err;
    }
  };

  // 14. Remove Group Member
  const removeGroupMember = async (conversationId, targetUserId) => {
    try {
      const data = await api.delete(
        `/api/conversations/${conversationId}/members/${targetUserId}`
      );

      if (targetUserId === user?.id) {
        setConversations((prev) =>
          prev.filter((c) => c.id !== conversationId)
        );

        if (activeIdRef.current === conversationId) {
          setActiveConversationId(null);
          localStorage.removeItem('chat_active_conv_id');
        }
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? data.conversation : c
          )
        );
      }

      return data;
    } catch (err) {
      console.error('Error removing group member:', err);
      throw err;
    }
  };

  // 15. Delete Conversation
  const deleteConversation = async (conversationId) => {
    try {
      await api.delete(`/api/conversations/${conversationId}`);

      setConversations((prev) =>
        prev.filter((c) => c.id !== conversationId)
      );

      setMessages((prev) => {
        const copy = { ...prev };
        delete copy[conversationId];
        return copy;
      });

      setTypingUsers((prev) => {
        const copy = { ...prev };
        delete copy[conversationId];
        return copy;
      });

      if (activeIdRef.current === conversationId) {
        setActiveConversationId(null);
        localStorage.removeItem('chat_active_conv_id');
      }

      return true;
    } catch (err) {
      console.error('Error deleting conversation:', err);
      throw err;
    }
  };

  // 16. Real-time Socket Events
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ message }) => {
      const currentActive = activeIdRef.current;
      const isCurrent = currentActive === message.conversationId;

      setMessages((prev) => {
        const existing = prev[message.conversationId] || [];

        if (existing.some((m) => m.id === message.id)) {
          return prev;
        }

        return {
          ...prev,
          [message.conversationId]: [...existing, message]
        };
      });

      setConversations((prev) => {
        const updated = prev.map((conv) => {
          if (conv.id !== message.conversationId) return conv;

          const isMine = message.senderId === user?.id;

          return {
            ...conv,
            lastMessage: {
              id: message.id,
              text: message.text,
              senderId: message.senderId,
              senderName:
                message.sender?.fullName ||
                message.sender?.username,
              createdAt: message.createdAt
            },
            unreadCount:
              isCurrent || isMine
                ? 0
                : (conv.unreadCount || 0) + 1,
            updatedAt: message.createdAt
          };
        });

        return updated.sort((a, b) => {
          const timeA = a.lastMessage?.createdAt
            ? new Date(a.lastMessage.createdAt)
            : new Date(a.updatedAt);

          const timeB = b.lastMessage?.createdAt
            ? new Date(b.lastMessage.createdAt)
            : new Date(b.updatedAt);

          return timeB - timeA;
        });
      });

      if (isCurrent && message.senderId !== user?.id) {
        api.post(
          `/api/conversations/${message.conversationId}/read`
        ).catch(() => {});
      }

      setTypingUsers((prev) => ({
        ...prev,
        [message.conversationId]: (
          prev[message.conversationId] || []
        ).filter((u) => u.id !== message.senderId)
      }));
    };

    const handleUpdatedMessage = ({ message }) => {
      setMessages((prev) => {
        const list = prev[message.conversationId] || [];

        return {
          ...prev,
          [message.conversationId]: list.map((m) =>
            m.id === message.id ? message : m
          )
        };
      });
    };

    const handleDeletedMessage = ({ message }) => {
      setMessages((prev) => {
        const list = prev[message.conversationId] || [];

        return {
          ...prev,
          [message.conversationId]: list.map((m) =>
            m.id === message.id ? message : m
          )
        };
      });
    };

    const handleConversationCreated = ({ conversation }) => {
      setConversations((prev) => {
        if (prev.some((c) => c.id === conversation.id)) {
          return prev;
        }

        return [conversation, ...prev];
      });

      socket.emit('conversation:join', {
        conversationId: conversation.id
      });
    };

    const handleConversationUpdated = ({ conversation }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversation.id ? conversation : c
        )
      );
    };

    const handleConversationRemoved = ({ conversationId }) => {
      setConversations((prev) =>
        prev.filter((c) => c.id !== conversationId)
      );

      if (activeIdRef.current === conversationId) {
        setActiveConversationId(null);
        localStorage.removeItem('chat_active_conv_id');
      }
    };

    const handleTypingStart = ({ conversationId, user: typingUser }) => {
      setTypingUsers((prev) => {
        const currentList = prev[conversationId] || [];

        if (currentList.some((u) => u.id === typingUser.id)) {
          return prev;
        }

        return {
          ...prev,
          [conversationId]: [...currentList, typingUser]
        };
      });
    };

    const handleTypingStop = ({ conversationId, userId }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [conversationId]: (
          prev[conversationId] || []
        ).filter((u) => u.id !== userId)
      }));
    };

    const handleMessagesRead = ({
      conversationId,
      readerId,
      readAt
    }) => {
      setMessages((prev) => {
        const list = prev[conversationId] || [];

        return {
          ...prev,
          [conversationId]: list.map((msg) => {
            if (msg.senderId !== readerId) {
              const readBy = msg.readBy || [];

              if (!readBy.some((r) => r.userId === readerId)) {
                return {
                  ...msg,
                  readBy: [
                    ...readBy,
                    { userId: readerId, readAt }
                  ]
                };
              }
            }

            return msg;
          })
        };
      });
    };

    const handleMessageReaction = ({
      messageId,
      conversationId,
      reactions
    }) => {
      setMessages((prev) => {
        const list = prev[conversationId] || [];

        return {
          ...prev,
          [conversationId]: list.map((m) =>
            m.id === messageId ? { ...m, reactions } : m
          )
        };
      });
    };

    const handleUserProfileUpdated = ({ user: updatedUser }) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (
            conv.type === 'direct' &&
            conv.otherUser?.id === updatedUser.id
          ) {
            return {
              ...conv,
              otherUser: {
                ...conv.otherUser,
                ...updatedUser
              }
            };
          }

          if (conv.type === 'group') {
            const updatedParticipants = conv.participants?.map((p) =>
              p.id === updatedUser.id
                ? { ...p, ...updatedUser }
                : p
            );

            return {
              ...conv,
              participants: updatedParticipants
            };
          }

          return conv;
        })
      );
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:updated', handleUpdatedMessage);
    socket.on('message:deleted', handleDeletedMessage);
    socket.on('messages:read', handleMessagesRead);
    socket.on('message:reaction', handleMessageReaction);
    socket.on('user:profile_updated', handleUserProfileUpdated);
    socket.on('conversation:created', handleConversationCreated);
    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('conversation:removed', handleConversationRemoved);
    socket.on('conversation:deleted', handleConversationRemoved);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:updated', handleUpdatedMessage);
      socket.off('message:deleted', handleDeletedMessage);
      socket.off('messages:read', handleMessagesRead);
      socket.off('message:reaction', handleMessageReaction);
      socket.off('user:profile_updated', handleUserProfileUpdated);
      socket.off('conversation:created', handleConversationCreated);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('conversation:removed', handleConversationRemoved);
      socket.off('conversation:deleted', handleConversationRemoved);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [socket, user?.id]);

  // 17. Active Conversation Data
  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || null;

  const activeMessages = activeConversationId
    ? messages[activeConversationId] || []
    : [];

  const currentTypingUsers = activeConversationId
    ? typingUsers[activeConversationId] || []
    : [];

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        activeMessages,
        currentTypingUsers,
        isLoadingConversations,
        isLoadingMessages,
        canLoadOlderMessages: !!messagePages[activeConversationId]?.hasMore,
        loadOlderMessages: () => loadOlderMessages(activeConversationId),
        selectConversation,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        createDirectChat,
        createGroupChat,
        deleteConversation,
        updateGroupInfo,
        addGroupMember,
        removeGroupMember,
        startTyping,
        stopTyping,
        refreshConversations: fetchConversations
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }

  return context;
};
