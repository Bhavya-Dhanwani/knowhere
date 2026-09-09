import React from 'react';
import { Bell } from 'lucide-react';
import { NotificationItem } from '../../../shared/types';

export interface NotificationPanelProps {
  notifications: NotificationItem[];
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ notifications }) => {
  return (
    <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center justify-between mb-3">
        <h3 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight">
          All Notifications
        </h3>
        {notifications.length > 0 ? (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            {notifications.length}
          </span>
        ) : null}
      </div>

      {notifications.length > 0 ? (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-3 rounded-xl border transition-all text-left ${
                notif.isRead
                  ? 'bg-zinc-50 border-zinc-200/60 opacity-80'
                  : 'bg-blue-50/50 border-blue-200/70 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-900 leading-snug">{notif.title}</p>
                <span className="text-[10px] text-zinc-400 shrink-0 whitespace-nowrap">
                  {notif.createdAt}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-2">
                {notif.message}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 flex flex-col items-center justify-center text-center flex-1">
          <Bell className="w-10 h-10 text-zinc-300 stroke-[1.5]" />
          <p className="text-sm font-semibold text-zinc-700 mt-2.5">No notifications available</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            You&apos;re all caught up! Check back later for updates.
          </p>
        </div>
      )}
    </div>
  );
};
