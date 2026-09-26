import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { AtSign, Bell, CornerDownRight, Megaphone } from 'lucide-react';
import { cn } from '../../../shared/lib/cn';
import { communityApi } from '../api/communityApi';
import { getSocket } from '../api/socket';
import { fmtTime } from './bits';

const icons = { mention: AtSign, reply: CornerDownRight, announcement: Megaphone };

// Live notifications (mentions, replies, announcements) from course communities.
export const NotificationBell: React.FC<{ align?: 'left' | 'right' }> = ({ align = 'right' }) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['notifications'], queryFn: communityApi.notifications });

  useEffect(() => {
    const s = getSocket();
    const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
    s.on('notification:new', refresh);
    s.on('notification:read', refresh);
    return () => {
      s.off('notification:new', refresh);
      s.off('notification:read', refresh);
    };
  }, [qc]);

  const unread = q.data?.unread || 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 place-items-center rounded-xl text-zinc-600 transition hover:bg-zinc-100"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread ? (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      <AnimatePresence>
        {open ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              className={cn(
                'fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl bg-white shadow-lift sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:w-80',
                align === 'right' ? 'sm:right-0' : 'sm:left-0'
              )}
            >
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900">Notifications</p>
                {unread ? (
                  <button
                    onClick={() => communityApi.readNotifications().then(() => q.refetch())}
                    className="text-xs font-medium text-brand-700 hover:text-brand-800"
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>
              <ul className="max-h-96 overflow-y-auto">
                {q.data?.items.length ? (
                  q.data.items.map((n) => {
                    const Icon = icons[n.type];
                    return (
                      <li key={n._id}>
                        <button
                          onClick={() => {
                            setOpen(false);
                            if (!n.readAt)
                              communityApi.readNotifications([n._id]).then(() => q.refetch());
                            navigate(`/course/${n.courseId}/community?c=${n.roomId}`);
                          }}
                          className={cn(
                            'flex w-full gap-3 px-4 py-3 text-left transition hover:bg-zinc-50',
                            !n.readAt && 'bg-brand-50/40'
                          )}
                        >
                          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-zinc-800">
                              <span className="font-medium">{n.actorName}</span> {n.text}
                            </span>
                            <span className="text-xs text-zinc-400">{fmtTime(n.createdAt)}</span>
                          </span>
                          {!n.readAt ? (
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-4 py-10 text-center text-sm text-zinc-500">
                    You're all caught up.
                  </li>
                )}
              </ul>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
