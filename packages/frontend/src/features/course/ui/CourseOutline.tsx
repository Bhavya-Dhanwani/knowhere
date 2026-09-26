import React, { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Lock } from 'lucide-react';
import { OutlineModule } from '../api/contentApi';
import { ITEM_META } from './itemMeta';
import { cn } from '../../../shared/lib/cn';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

interface CourseOutlineProps {
  courseId: string;
  modules: OutlineModule[];
  activeItemId?: string;
  compact?: boolean;
  onNavigate?: () => void;
}

// Collapsible module → lesson → item tree. Modules containing the active item start open.
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
    <ol className={cn('space-y-2', compact && 'space-y-1')}>
      {modules.map((m, mi) => {
        const items = m.lessons.flatMap((l) => l.items);
        const done = items.filter((i) => i.completed).length;
        const isOpen = open.has(m.id);
        return (
          <li
            key={m.id}
            className={cn(!compact && 'overflow-hidden rounded-2xl bg-white shadow-card')}
          >
            <button
              onClick={() => toggle(m.id)}
              aria-expanded={isOpen}
              className={cn(
                'flex w-full items-center gap-3 text-left transition',
                compact
                  ? 'rounded-xl px-2 py-2 hover:bg-zinc-100'
                  : 'px-4 py-3.5 hover:bg-zinc-50 sm:px-5'
              )}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-100 font-mono text-xs text-zinc-500">
                {String(mi + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block truncate font-medium text-zinc-900',
                    compact ? 'text-[13px]' : 'text-sm'
                  )}
                >
                  {m.title}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {m.schedule?.locked ? (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <Lock className="h-3 w-3" /> Opens {shortDate(m.schedule.startsAt)}
                    </span>
                  ) : (
                    <>
                      {done}/{items.length} done
                      {m.schedule ? ` · due ${shortDate(m.schedule.deadline)}` : ''}
                    </>
                  )}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-zinc-400 transition-transform',
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
                  <div
                    className={cn(
                      compact ? 'pb-1 pl-2' : 'border-t border-zinc-100 px-2 pb-2 pt-1 sm:px-3'
                    )}
                  >
                    {m.lessons.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-zinc-400">No lessons yet.</p>
                    ) : (
                      m.lessons.map((l) => (
                        <div key={l.id} className="mt-2">
                          <p className="truncate px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                            {l.title}
                          </p>
                          {l.items.length === 0 ? (
                            <p className="px-3 py-1.5 text-xs text-zinc-400">Nothing here yet.</p>
                          ) : (
                            l.items.map((it) => {
                              const meta = ITEM_META[it.type];
                              const active = it.id === activeItemId;
                              const locked = Boolean(m.schedule?.locked);
                              return (
                                <Link
                                  key={it.id}
                                  to={locked ? '#' : `/course/${courseId}/learn/${it.id}`}
                                  onClick={(e) => (locked ? e.preventDefault() : onNavigate?.())}
                                  aria-disabled={locked || undefined}
                                  className={cn(
                                    'group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition',
                                    locked
                                      ? 'cursor-not-allowed text-zinc-400'
                                      : active
                                        ? 'bg-brand-50 text-brand-800'
                                        : 'text-zinc-600 hover:bg-zinc-100/80'
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'grid h-5 w-5 shrink-0 place-items-center rounded-full ring-1 ring-inset',
                                      it.completed
                                        ? 'bg-emerald-500 text-white ring-emerald-500'
                                        : active
                                          ? 'ring-brand-400'
                                          : 'ring-zinc-300'
                                    )}
                                  >
                                    {it.completed ? <Check className="h-3 w-3" /> : null}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{it.title}</span>
                                  <meta.icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
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
