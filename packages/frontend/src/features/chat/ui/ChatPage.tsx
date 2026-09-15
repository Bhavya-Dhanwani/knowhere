import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../app/store';
import { logout } from '../../auth/state/authSlice';
import { Header } from '../../../shared/ui/Header';
import { chatApi } from '../api/chatApi';
import {
  joinChatRoom,
  leaveChatRoom,
  sendChatMessage,
  sendTypingStatus,
  sendReaction,
  sendEditMessage,
  sendDeleteMessage,
  subscribeToChatEvents
} from '../api/chatSocket';
import { ChatRoom, ChatMessage, UserTypingEvent } from '../types';
import { ChannelSidebar } from './ChannelSidebar';
import { MessageFeed } from './MessageFeed';
import { MemberList } from './MemberList';
import { CreateChannelModal } from './CreateChannelModal';
import { MessageSquarePlus } from 'lucide-react';

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<UserTypingEvent[]>([]);
  const [showMembers, setShowMembers] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // 1. Fetch accessible rooms
  const loadRooms = useCallback(async () => {
    try {
      setIsLoadingRooms(true);
      const list = await chatApi.getRooms();
      setRooms(list);
      if (list.length > 0 && !activeRoomId) {
        setActiveRoomId(list[0]._id);
      }
    } catch (err) {
      console.error('Failed to load chat rooms', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, [activeRoomId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // 2. Room switch effect: Leave old room, join new room, load message history
  useEffect(() => {
    if (!activeRoomId) return;

    let isMounted = true;

    // Join room via socket
    joinChatRoom(activeRoomId).then((res) => {
      if (isMounted && res.onlineUsers) {
        setOnlineUserIds(res.onlineUsers);
      }
    });

    // Fetch message history
    chatApi.getMessages(activeRoomId).then((data) => {
      if (isMounted) {
        setMessages(data);
      }
    });

    return () => {
      isMounted = false;
      leaveChatRoom(activeRoomId);
    };
  }, [activeRoomId]);

  // 3. Socket event subscriptions
  useEffect(() => {
    const unsubscribe = subscribeToChatEvents({
      onNewMessage: (newMsg) => {
        if (newMsg.roomId === activeRoomId) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === newMsg._id)) return prev;
            return [...prev, newMsg];
          });
        }
      },
      onMessageUpdated: (updatedMsg) => {
        if (updatedMsg.roomId === activeRoomId) {
          setMessages((prev) => prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m)));
        }
      },
      onMessageDeleted: ({ messageId, roomId }) => {
        if (roomId === activeRoomId) {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === messageId
                ? {
                    ...m,
                    deletedAt: new Date().toISOString(),
                    content: '*(This message was deleted)*'
                  }
                : m
            )
          );
        }
      },
      onTyping: (data) => {
        setTypingUsers((prev) => {
          const filtered = prev.filter((t) => t.userId !== data.userId);
          if (data.isTyping) {
            return [...filtered, data];
          }
          return filtered;
        });
      },
      onPresence: ({ roomId, onlineUsers }) => {
        if (roomId === activeRoomId) {
          setOnlineUserIds(onlineUsers);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeRoomId]);

  // Handlers
  const handleSendMessage = async (
    content: string,
    replyTo?: { messageId: string; senderName: string; snippet: string }
  ) => {
    if (!activeRoomId) return;
    await sendChatMessage(activeRoomId, content, [], replyTo);
  };

  const handleSendTyping = (isTyping: boolean) => {
    if (!activeRoomId) return;
    sendTypingStatus(activeRoomId, isTyping);
  };

  const handleReact = (messageId: string, emoji: string) => {
    if (!activeRoomId) return;
    sendReaction(messageId, activeRoomId, emoji);
  };

  const handleEditMessage = (messageId: string, content: string) => {
    if (!activeRoomId) return;
    sendEditMessage(messageId, activeRoomId, content);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!activeRoomId) return;
    sendDeleteMessage(messageId, activeRoomId);
  };

  const handleCreateRoom = async (data: {
    name: string;
    description: string;
    type: 'public' | 'course' | 'private_group';
    courseId?: string;
  }) => {
    const newRoom = await chatApi.createRoom(data);
    setRooms((prev) => [newRoom, ...prev]);
    setActiveRoomId(newRoom._id);
  };

  const activeRoom = rooms.find((r) => r._id === activeRoomId);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden font-sans text-zinc-100 antialiased">
      <Header
        user={currentUser as any}
        onLogout={handleLogout}
        onNavigateHome={() => navigate('/dashboard')}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* 1. Left Channel Sidebar */}
        <ChannelSidebar
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={(id) => setActiveRoomId(id)}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          currentUser={{
            name: currentUser?.name || 'User',
            email: currentUser?.email,
            role: currentUser?.roles?.[0]
          }}
        />

        {/* 2. Main Chat Area */}
        {activeRoom ? (
          <MessageFeed
            room={activeRoom}
            messages={messages}
            currentUserId={currentUser?.id || ''}
            typingUsers={typingUsers}
            onSendMessage={handleSendMessage}
            onSendTyping={handleSendTyping}
            onReact={handleReact}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            onToggleMembers={() => setShowMembers((prev) => !prev)}
            showMembers={showMembers}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zinc-950 text-zinc-400">
            {isLoadingRooms ? (
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            ) : (
              <div className="max-w-md space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-indigo-400">
                  <MessageSquarePlus className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">No Channels Yet</h3>
                <p className="text-sm text-zinc-400">
                  Create a public channel to start chatting with students, instructors, and study
                  groups!
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
                >
                  Create First Channel
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. Right Member List Sidebar (Collapsible) */}
        {activeRoom && showMembers && (
          <MemberList
            members={activeRoom.members}
            onlineUserIds={onlineUserIds}
            allProfiles={{
              [currentUser?.id || '']: {
                name: currentUser?.name || 'You',
                role: currentUser?.roles?.[0] || 'trainee'
              }
            }}
          />
        )}

        {/* Create Channel Modal */}
        <CreateChannelModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateRoom}
        />
      </div>
    </div>
  );
};
