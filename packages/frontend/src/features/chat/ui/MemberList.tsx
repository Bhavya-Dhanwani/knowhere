import React from 'react';
import { ShieldCheck, GraduationCap } from 'lucide-react';
import { RoomMember } from '../types';

interface Props {
  members: RoomMember[];
  onlineUserIds: string[];
  allProfiles?: Record<string, { name: string; avatar?: string; role?: string }>;
}

export const MemberList: React.FC<Props> = ({ members, onlineUserIds, allProfiles = {} }) => {
  const onlineSet = new Set(onlineUserIds);

  const enrichedMembers = members.map((m) => {
    const profile = allProfiles[m.userId] || {};
    return {
      userId: m.userId,
      name: profile.name || `User ${m.userId.slice(-4)}`,
      avatar: profile.avatar || '',
      role: profile.role || m.role || 'trainee',
      isOnline: onlineSet.has(m.userId)
    };
  });

  const onlineMembers = enrichedMembers.filter((m) => m.isOnline);
  const offlineMembers = enrichedMembers.filter((m) => !m.isOnline);

  const renderRoleBadge = (role: string) => {
    if (role === 'admin') {
      return (
        <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded uppercase">
          <ShieldCheck className="w-2.5 h-2.5" />
          Admin
        </span>
      );
    }
    if (role === 'trainer') {
      return (
        <span className="flex items-center gap-0.5 text-[9px] font-bold text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded uppercase">
          <GraduationCap className="w-2.5 h-2.5" />
          Instructor
        </span>
      );
    }
    return null;
  };

  return (
    <aside className="w-60 bg-zinc-900/70 border-l border-zinc-800 flex flex-col select-none overflow-y-auto px-3 py-4 space-y-4">
      {/* Online Section */}
      <div>
        <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1">
          Online — {onlineMembers.length}
        </h4>
        <div className="space-y-1">
          {onlineMembers.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-zinc-800/60 transition cursor-pointer"
            >
              <div className="relative">
                {m.avatar ? (
                  <img src={m.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-700 text-zinc-300 font-bold flex items-center justify-center text-xs">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-900" />
              </div>
              <div className="overflow-hidden flex-1">
                <div className="text-xs font-medium text-zinc-200 truncate">{m.name}</div>
                {renderRoleBadge(m.role)}
              </div>
            </div>
          ))}

          {onlineMembers.length === 0 && (
            <div className="px-2 text-xs text-zinc-500 italic">No one online right now</div>
          )}
        </div>
      </div>

      {/* Offline Section */}
      {offlineMembers.length > 0 && (
        <div>
          <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">
            Offline — {offlineMembers.length}
          </h4>
          <div className="space-y-1 opacity-70">
            {offlineMembers.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-zinc-800/40 transition cursor-pointer"
              >
                <div className="relative">
                  {m.avatar ? (
                    <img
                      src={m.avatar}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover grayscale"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-500 font-bold flex items-center justify-center text-xs">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-zinc-600 border-2 border-zinc-900" />
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="text-xs font-medium text-zinc-400 truncate">{m.name}</div>
                  {renderRoleBadge(m.role)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
