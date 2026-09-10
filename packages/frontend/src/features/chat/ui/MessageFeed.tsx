import React, { useState, useRef, useEffect } from 'react';
import { Hash, Smile, Send, Reply, Trash2, Edit2, Pin, X, Users, Code } from 'lucide-react';
import { ChatRoom, ChatMessage, UserTypingEvent } from '../types';

interface Props {
  room: ChatRoom;
  messages: ChatMessage[];
  currentUserId: string;
  typingUsers: UserTypingEvent[];
  onSendMessage: (
    content: string,
    replyTo?: { messageId: string; senderName: string; snippet: string }
  ) => Promise<void>;
  onSendTyping: (isTyping: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onToggleMembers: () => void;
  showMembers: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '🚀', '💡', '🎉'];

export const MessageFeed: React.FC<Props> = ({
  room,
  messages,
  currentUserId,
  typingUsers,
  onSendMessage,
  onSendTyping,
  onReact,
  onDeleteMessage,
  onEditMessage,
  onToggleMembers,
  showMembers
}) => {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Typing broadcast throttling
    onSendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
    }, 2000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const replyData = replyingTo
      ? {
          messageId: replyingTo._id,
          senderName: replyingTo.sender.name,
          snippet: replyingTo.content.slice(0, 70)
        }
      : undefined;

    const textToSend = inputText;
    setInputText('');
    setReplyingTo(null);
    onSendTyping(false);

    await onSendMessage(textToSend, replyData);
  };

  const startEdit = (msg: ChatMessage) => {
    setEditingMessageId(msg._id);
    setEditContent(msg.content);
  };

  const saveEdit = (messageId: string) => {
    if (!editContent.trim()) return;
    onEditMessage(messageId, editContent.trim());
    setEditingMessageId(null);
  };

  // Format Discord-like message date
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Filter typing users for current room excluding self
  const currentTyping = typingUsers.filter(
    (t) => t.roomId === room._id && t.userId !== currentUserId && t.isTyping
  );

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 min-w-0">
      {/* Channel Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <Hash className="w-5 h-5 text-zinc-400 shrink-0" />
          <h3 className="font-bold text-white text-base truncate">{room.name}</h3>
          {room.description && (
            <>
              <span className="text-zinc-600">|</span>
              <p className="text-xs text-zinc-400 truncate hidden md:block">{room.description}</p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMembers}
            title={showMembers ? 'Hide Member List' : 'Show Member List'}
            className={`p-2 rounded-lg transition ${
              showMembers
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
        {/* Welcome Header */}
        <div className="pt-8 pb-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-3">
            <Hash className="w-10 h-10 text-zinc-300" />
          </div>
          <h2 className="text-2xl font-black text-white">Welcome to #{room.name}!</h2>
          <p className="text-sm text-zinc-400 mt-1">
            This is the start of the #{room.name} channel. Send messages, share code, and
            collaborate.
          </p>
        </div>

        {/* Message Items */}
        {messages.map((msg) => {
          const isOwn = msg.sender.userId === currentUserId;
          const isDeleted = Boolean(msg.deletedAt);

          return (
            <div
              key={msg._id}
              className={`group relative flex gap-3 p-2 -mx-2 rounded-lg hover:bg-zinc-900/50 transition ${
                msg.isPinned ? 'bg-indigo-950/20 border-l-2 border-indigo-500 pl-3' : ''
              }`}
            >
              {/* Avatar */}
              <div className="shrink-0 pt-0.5">
                {msg.sender.avatar ? (
                  <img
                    src={msg.sender.avatar}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-sm shadow">
                    {msg.sender.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Message Body */}
              <div className="flex-1 min-w-0">
                {/* Reply Citation (Discord style) */}
                {msg.replyTo && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
                    <Reply className="w-3.5 h-3.5 rotate-180 text-zinc-500" />
                    <span className="font-semibold text-indigo-300">@{msg.replyTo.senderName}</span>
                    <span className="truncate italic text-zinc-500">"{msg.replyTo.snippet}"</span>
                  </div>
                )}

                {/* Author Info & Timestamp */}
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      msg.sender.role === 'trainer' || msg.sender.role === 'admin'
                        ? 'text-indigo-400'
                        : 'text-zinc-100'
                    }`}
                  >
                    {msg.sender.name}
                  </span>
                  {msg.sender.role === 'trainer' && (
                    <span className="text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                      Instructor
                    </span>
                  )}
                  {msg.sender.role === 'admin' && (
                    <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-500">{formatTime(msg.createdAt)}</span>
                  {msg.isPinned && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-medium">
                      <Pin className="w-2.5 h-2.5" /> Pinned
                    </span>
                  )}
                </div>

                {/* Content or Edit Input */}
                {editingMessageId === msg._id ? (
                  <div className="mt-1">
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                      <span>
                        escape to{' '}
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="text-indigo-400 underline"
                        >
                          cancel
                        </button>
                      </span>
                      <span>•</span>
                      <span>
                        enter to{' '}
                        <button
                          onClick={() => saveEdit(msg._id)}
                          className="text-indigo-400 underline"
                        >
                          save
                        </button>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`mt-0.5 text-sm leading-relaxed break-words ${
                      isDeleted ? 'text-zinc-500 italic' : 'text-zinc-200'
                    }`}
                  >
                    {msg.content.startsWith('```') ? (
                      <pre className="mt-1 p-3 rounded-lg bg-zinc-900 font-mono text-xs text-indigo-200 overflow-x-auto border border-zinc-800">
                        <code>{msg.content.replace(/```[a-z]*\n?/g, '')}</code>
                      </pre>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                    {msg.isEdited && !isDeleted && (
                      <span className="text-[10px] text-zinc-500 ml-1.5">(edited)</span>
                    )}
                  </div>
                )}

                {/* Reactions Pill Display */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.reactions.map((r) => {
                      const userReacted = r.users.includes(currentUserId);
                      return (
                        <button
                          key={r.emoji}
                          onClick={() => onReact(msg._id, r.emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border transition ${
                            userReacted
                              ? 'bg-indigo-950/60 border-indigo-600 text-indigo-200'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span className="text-[11px]">{r.count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Hover Floating Action Bar (Discord Style) */}
              {!isDeleted && (
                <div className="absolute right-3 -top-3 hidden group-hover:flex items-center bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-lg px-1 py-0.5 gap-0.5 z-10">
                  {/* Quick Emojis */}
                  {COMMON_EMOJIS.slice(0, 3).map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onReact(msg._id, emoji)}
                      title={`React ${emoji}`}
                      className="p-1 hover:bg-zinc-800 rounded text-sm transition"
                    >
                      {emoji}
                    </button>
                  ))}

                  <button
                    onClick={() =>
                      setShowEmojiPickerFor(showEmojiPickerFor === msg._id ? null : msg._id)
                    }
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
                    title="Add Reaction"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
                    title="Reply"
                  >
                    <Reply className="w-4 h-4" />
                  </button>

                  {isOwn && (
                    <button
                      onClick={() => startEdit(msg)}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}

                  {isOwn && (
                    <button
                      onClick={() => onDeleteMessage(msg._id)}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-red-400 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Replying Banner */}
      {replyingTo && (
        <div className="px-4 py-1.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-300">
          <div className="flex items-center gap-1.5 truncate">
            <Reply className="w-3.5 h-3.5 rotate-180 text-indigo-400 shrink-0" />
            <span>
              Replying to <strong className="text-white">@{replyingTo.sender.name}</strong>
            </span>
            <span className="text-zinc-500 truncate">"{replyingTo.content.slice(0, 60)}"</span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-zinc-400 hover:text-white rounded transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Typing Indicator Footer */}
      <div className="h-5 px-4 text-[11px] text-zinc-400 italic">
        {currentTyping.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            {currentTyping.map((t) => t.userName).join(', ')}{' '}
            {currentTyping.length === 1 ? 'is typing...' : 'are typing...'}
          </span>
        )}
      </div>

      {/* Message Input Container */}
      <div className="px-4 pb-4">
        <form
          onSubmit={handleSend}
          className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-4 py-2.5 flex items-center gap-3 focus-within:border-zinc-700 transition shadow-inner"
        >
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={`Message #${room.name}`}
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />

          <div className="flex items-center gap-1.5 text-zinc-400">
            <button
              type="button"
              onClick={() => setInputText((prev) => `${prev} \`\`\`\n// code here\n\`\`\``)}
              title="Insert Code Snippet"
              className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-white transition"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 transition shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
