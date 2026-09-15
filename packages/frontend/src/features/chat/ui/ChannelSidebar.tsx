import React from 'react';
import { Hash, Plus, GraduationCap, Users, Settings, Mic, Headphones } from 'lucide-react';
import { ChatRoom } from '../types';

interface Props {
  rooms: ChatRoom[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onOpenCreateModal: () => void;
  currentUser: { name: string; email?: string; avatar?: string; role?: string };
}

export const ChannelSidebar: React.FC<Props> = ({
  rooms,
  activeRoomId,
  onSelectRoom,
  onOpenCreateModal,
  currentUser
}) => {
  const publicRooms = rooms.filter((r) => r.type === 'public' || r.type === 'private_group');
  const courseRooms = rooms.filter((r) => r.type === 'course');

  return (
    <aside className="w-64 flex flex-col bg-zinc-900/90 border-r border-zinc-800 select-none">
      {/* Community / Server Banner Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-indigo-600/30">
            K
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Knowhere Hub</h2>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Community Online
            </span>
          </div>
        </div>
      </div>

      {/* Channel Categories & List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
        {/* Category: Public Channels */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              Channels
            </span>
            <button
              onClick={onOpenCreateModal}
              title="Create Channel"
              className="p-0.5 rounded hover:text-white hover:bg-zinc-800 transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {publicRooms.map((room) => {
              const isActive = room._id === activeRoomId;
              return (
                <button
                  key={room._id}
                  onClick={() => onSelectRoom(room._id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition text-left ${
                    isActive
                      ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <Hash
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`}
                  />
                  <span className="truncate">{room.name}</span>
                </button>
              );
            })}

            {publicRooms.length === 0 && (
              <div className="px-2 py-2 text-xs text-zinc-400 italic">No channels yet</div>
            )}
          </div>
        </div>

        {/* Category: Course Study Channels */}
        {courseRooms.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2 mb-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                Course Channels
              </span>
            </div>

            <div className="space-y-0.5">
              {courseRooms.map((room) => {
                const isActive = room._id === activeRoomId;
                return (
                  <button
                    key={room._id}
                    onClick={() => onSelectRoom(room._id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition text-left ${
                      isActive
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    <GraduationCap
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`}
                    />
                    <span className="truncate">{room.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Discord-style Bottom User Bar */}
      <div className="h-14 bg-zinc-950/80 px-3 flex items-center justify-between border-t border-zinc-800/80">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="relative shrink-0">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-xs">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
            <div className="text-[10px] text-zinc-500 capitalize truncate">
              {currentUser.role || 'Trainee'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-zinc-400">
          <button
            title="Mute"
            className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
          <button
            title="Deafen"
            className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition"
          >
            <Headphones className="w-3.5 h-3.5" />
          </button>
          <button
            title="Settings"
            className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
