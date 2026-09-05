import React from 'react';
import { NotificationItem } from '../../../shared/types';

export interface NotificationPanelProps {
  notifications: NotificationItem[];
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ notifications }) => {
  return (
    <div className="bg-surface border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <svg
            className="w-4 h-4 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          Notifications
        </h3>
        {notifications.length > 0 ? (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
            {notifications.length}
          </span>
        ) : null}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-3 rounded-xl border transition-all text-left ${
                notif.isRead
                  ? 'bg-background/40 border-white/5 opacity-80'
                  : 'bg-background/80 border-primary/20 shadow-sm shadow-primary/5'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-white leading-snug">{notif.title}</p>
                <span className="text-[10px] text-muted shrink-0 whitespace-nowrap">
                  {notif.createdAt}
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">
                {notif.message}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-muted">No notifications available</div>
      )}
    </div>
  );
};
