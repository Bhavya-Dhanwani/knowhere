import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { CornerDownLeft, LogOut, Search } from 'lucide-react';
import { NavSection } from './navigation';
import { cn } from '../lib/cn';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: NavSection[];
  onLogout: () => void;
}

// ⌘K / Ctrl+K quick navigation across everything the current role can reach.
export const CommandMenu: React.FC<CommandMenuProps> = ({
  open,
  onOpenChange,
  sections,
  onLogout
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo(() => {
    const nav = sections.flatMap((s) =>
      s.items.map((i) => ({
        id: i.to,
        label: i.label,
        group: s.title || 'Navigate',
        icon: i.icon,
        run: () => navigate(i.to)
      }))
    );
    return [
      ...nav,
      { id: 'logout', label: 'Sign out', group: 'Account', icon: LogOut, run: onLogout }
    ];
  }, [sections, navigate, onLogout]);

  const results = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const run = (i: number) => {
    const a = results[i];
    if (!a) return;
    onOpenChange(false);
    a.run();
  };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-zinc-950/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-label="Command menu"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200"
          >
            <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4">
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCursor((c) => Math.min(c + 1, results.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCursor((c) => Math.max(c - 1, 0));
                  } else if (e.key === 'Enter') {
                    run(cursor);
                  } else if (e.key === 'Escape') {
                    onOpenChange(false);
                  }
                }}
                placeholder="Jump to…"
                className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
              />
              <kbd className="hidden rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 xs:block">
                ESC
              </kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-zinc-500">No matches</li>
              ) : (
                results.map((a, i) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => run(i)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition',
                        i === cursor ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600'
                      )}
                    >
                      <a.icon className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="min-w-0 flex-1 truncate">{a.label}</span>
                      <span className="hidden text-xs text-zinc-400 xs:inline">{a.group}</span>
                      {i === cursor ? (
                        <CornerDownLeft className="h-3.5 w-3.5 text-zinc-400" />
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
