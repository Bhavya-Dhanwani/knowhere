import React, { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Lock } from 'lucide-react';
import { OutlineModule } from '../api/contentApi';
import { ITEM_META } from './itemMeta';
import { cn } from '../../../shared/lib/cn';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const longDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
const WEEK = 7 * 24 * 3600 * 1000;

const Tag: React.FC<{ children: React.ReactNode; tone?: 'dark' | 'line' | 'amber' }> = ({
  children,
  tone = 'line'
}) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
      tone === 'dark' && 'bg-zinc-900 text-white',
      tone === 'line' && 'text-zinc-600 ring-1 ring-inset ring-zinc-300',
      tone === 'amber' && 'text-amber-700 ring-1 ring-inset ring-amber-300'
    )}
  >
    {children}
  </span>
);

interface CourseOutlineProps {
  courseId: string;
  modules: OutlineModule[];
  activeItemId?: string;
  compact?: boolean;
  onNavigate?: () => void;
}

// Collapsible module → lesson → item list. Modules containing the active item start open.
export const CourseOutline: React.FC<CourseOutlineProps> = ({
  courseId,
  modules,
  activeItemId,
  compact,
  onNavigate
}) => {
  const initiallyOpen = new Set(
    modules
      .filter(
        (m, i) => i === 0 || m.lessons.some((l) => l.items.some((it) => it.id === activeItemId))
      )
      .map((m) => m.id)
  );
  const [open, setOpen] = useState<Set<string>>(initiallyOpen);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ol className={cn(compact ? 'space-y-1' : 'divide-y divide-zinc-100')}>
      {modules.map((m) => {
        const items = m.lessons.flatMap((l) => l.items);
        const done = items.filter((i) => i.completed).length;
        const complete = items.length > 0 && done === items.length;
        const locked = Boolean(m.schedule?.locked);
        const isNew =
          !locked && m.schedule && Date.now() - new Date(m.schedule.startsAt).getTime() < WEEK;
        const isOpen = open.has(m.id);
        const hasActive = items.some((i) => i.id === activeItemId);
        return (
          <li key={m.id}>
            <button
              onClick={() => toggle(m.id)}
              aria-expanded={isOpen}
              className={cn(
                'flex w-full items-center gap-3 text-left transition',
                compact ? 'rounded-xl px-2 py-2 hover:bg-zinc-100' : 'px-5 py-5 hover:bg-zinc-50/70'
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'min-w-0 font-medium text-zinc-900',
                      compact ? 'truncate text-[13px]' : 'text-lg tracking-tight'
                    )}
                  >
                    {m.title}
                  </span>
                  {!compact && isNew ? <Tag tone="dark">New</Tag> : null}
                  {!compact && complete ? <Tag>Completed</Tag> : null}
                  {!compact && locked ? (
                    <Tag tone="amber">
                      <Lock className="h-3 w-3" /> Opens {shortDate(m.schedule.startsAt)}
                    </Tag>
                  ) : null}
                </span>
                {compact ? (
                  <span className="block truncate text-xs text-zinc-500">
                    {locked
                      ? `Opens ${shortDate(m.schedule.startsAt)}`
                      : `${done}/${items.length} done`}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {done}/{items.length} done
                    {m.schedule && !locked ? ` · due ${shortDate(m.schedule.deadline)}` : ''}
                  </span>
                )}
              </span>
              {!compact && hasActive && !isOpen ? (
                <span className="hidden rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white sm:inline">
                  Resume learning
                </span>
              ) : null}
              <ChevronDown
                className={cn(
                  'shrink-0 text-zinc-400 transition-transform',
                  compact ? 'h-4 w-4' : 'h-5 w-5',
                  isOpen && 'rotate-180'
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className={cn(compact ? 'pb-1 pl-2' : 'px-3 pb-4 sm:px-4')}>
                    {m.lessons.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-zinc-400">No lessons yet.</p>
                    ) : (
                      m.lessons.map((l) => (
                        <div key={l.id} className="mt-1">
                          <p className="truncate px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                            {l.title}
                          </p>
                          {l.items.length === 0 ? (
                            <p className="px-3 py-1.5 text-xs text-zinc-400">Nothing here yet.</p>
                          ) : (
                            l.items.map((it) => {
                              const meta = ITEM_META[it.type];
                              const active = it.id === activeItemId;
                              return (
                                <Link
                                  key={it.id}
                                  to={locked ? '#' : `/course/${courseId}/learn/${it.id}`}
                                  onClick={(e) => (locked ? e.preventDefault() : onNavigate?.())}
                                  aria-disabled={locked || undefined}
                                  className={cn(
                                    'group flex items-start gap-3 rounded-xl px-3 py-2 transition',
                                    locked
                                      ? 'cursor-not-allowed text-zinc-400'
                                      : active
                                        ? 'bg-zinc-100 text-zinc-900'
                                        : 'text-zinc-700 hover:bg-zinc-50'
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ring-1 ring-inset',
                                      it.completed
                                        ? 'bg-zinc-900 text-white ring-zinc-900'
                                        : active
                                          ? 'ring-zinc-900'
                                          : 'ring-zinc-300'
                                    )}
                                  >
                                    {it.completed ? <Check className="h-3 w-3" /> : null}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span
                                      className={cn(
                                        'block truncate',
                                        compact ? 'text-[13px]' : 'text-[15px]'
                                      )}
                                    >
                                      {it.title}
                                    </span>
                                    {!compact && m.schedule && !locked ? (
                                      <span className="block text-xs text-zinc-400">
                                        Deadline: {longDate(m.schedule.deadline)}
                                      </span>
                                    ) : null}
                                  </span>
                                  {!compact && it.maxScore ? (
                                    <span className="shrink-0 pt-0.5 font-mono text-xs text-zinc-400">
                                      {it.scoreEarned}/{it.maxScore}
                                    </span>
                                  ) : null}
                                  <meta.icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                                </Link>
                              );
                            })
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </li>
        );
      })}
    </ol>
  );
};
