import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Bot, Minus, Plus, SendHorizontal } from 'lucide-react';
import { postStream } from '../lib/sse';
import { cn } from '../lib/cn';
import { greeting } from '../lib/format';
import CountUp from '../ui/reactbits/CountUp';

// Building blocks for every role's dashboard: calm white cards, one greeting, the assistant.

export const Greeting: React.FC<{ name: string; subtitle: string; action?: React.ReactNode }> = ({
  name,
  subtitle,
  action
}) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <p className="text-sm text-zinc-500">{greeting()},</p>
      <h1 className="mt-0.5 truncate text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        {name}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      <p className="text-sm text-zinc-500">
        {new Date().toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })}
      </p>
      {action}
    </div>
  </div>
);

export const StatTile: React.FC<{
  icon: React.ReactNode;
  value: number | null;
  label: string;
  suffix?: string;
  to?: string;
}> = ({ icon, value, label, suffix, to }) => {
  const body = (
    <>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-zinc-700 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">
          {value === null ? '—' : <CountUp to={value} duration={1.2} />}
          {value !== null && suffix ? <span className="text-zinc-400">{suffix}</span> : null}
        </span>
        <span className="block truncate text-sm text-zinc-500">{label}</span>
      </span>
      {to ? (
        <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-900" />
      ) : null}
    </>
  );
  const cls =
    'group flex items-center gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 transition sm:p-5';
  return to ? (
    <Link to={to} className={cn(cls, 'hover:border-zinc-300 hover:shadow-card')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
};

export const Panel: React.FC<{
  title: string;
  viewAll?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, viewAll, className, children }) => (
  <section className={cn('min-w-0 rounded-2xl border border-zinc-200/80 bg-white', className)}>
    <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
      <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
      {viewAll ? (
        <Link
          to={viewAll}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-900"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
    <div className="custom-scrollbar max-h-[440px] overflow-y-auto px-2 pb-3 sm:px-3">
      {children}
    </div>
  </section>
);

// main column + assistant column on wide screens; the assistant drops below on smaller ones
export const DashboardGrid: React.FC<{ children: React.ReactNode; aside: React.ReactNode }> = ({
  children,
  aside
}) => (
  <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 px-3 py-5 sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div className="min-w-0 space-y-6">{children}</div>
    <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">{aside}</aside>
  </div>
);

export interface AssistantChip {
  label: string;
  // answered instantly from data the page already loaded
  answer: () => React.ReactNode;
}

interface Turn {
  from: 'you' | 'ai';
  body: React.ReactNode;
  // the answer currently streaming in (replaced on every token)
  streaming?: boolean;
}

// "Knowhere AI": suggestion chips answer from the page's real data; free-text questions go to
// the assistant endpoint, which only sees the same `facts`.
export const AssistantPanel: React.FC<{ chips: AssistantChip[]; facts: string }> = ({
  chips,
  facts
}) => {
  const [open, setOpen] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // braces matter: scrollIntoView returns a Promise in current browsers, not a cleanup
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [turns.length, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setDraft('');
    setTurns((t) => [...t, { from: 'you', body: q }]);
    setBusy(true);
    let text = '';
    const show = (value: string) =>
      setTurns((t) => [
        ...(t[t.length - 1]?.streaming ? t.slice(0, -1) : t),
        {
          from: 'ai',
          streaming: true,
          body: <span className="whitespace-pre-wrap">{value}</span>
        }
      ]);
    try {
      await postStream(
        '/course/assistant/stream',
        { question: q, facts },
        {
          onToken: (chunk) => show((text += chunk)),
          onRestart: () => show((text = ''))
        }
      );
    } catch (e) {
      show((e as Error).message);
    } finally {
      setTurns((t) => t.map((x) => ({ ...x, streaming: false })));
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white xl:h-[calc(100dvh-7rem)]">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-zinc-200 text-zinc-700">
          <Bot className="h-3.5 w-3.5" />
        </span>
        <p className="flex-1 text-[15px] font-semibold text-zinc-900">Knowhere AI</p>
        <button
          onClick={() => setOpen((o) => !o)}
          className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
          aria-label={open ? 'Collapse assistant' : 'Expand assistant'}
          aria-expanded={open}
        >
          {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div
              className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
              aria-live="polite"
            >
              <p className="rounded-2xl rounded-tl-md bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-700">
                Hi! I’m Knowhere AI.
                <br />
                How can I help you today?
              </p>
              <div className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <button
                    key={c.label}
                    onClick={() =>
                      setTurns((t) => [
                        ...t,
                        { from: 'you', body: c.label },
                        { from: 'ai', body: c.answer() }
                      ])
                    }
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-left text-xs text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {turns.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm',
                    t.from === 'you'
                      ? 'ml-auto rounded-tr-md bg-zinc-900 text-white'
                      : 'rounded-tl-md bg-zinc-100 text-zinc-700'
                  )}
                >
                  {t.body}
                </motion.div>
              ))}
              {busy && !turns[turns.length - 1]?.streaming ? (
                <div className="flex w-14 gap-1 rounded-2xl rounded-tl-md bg-zinc-100 px-3.5 py-3">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-zinc-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                    />
                  ))}
                </div>
              ) : null}
              <div ref={end} />
            </div>
            <form
              className="flex items-center gap-2 border-t border-zinc-100 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask(draft);
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                maxLength={500}
                aria-label="Ask Knowhere AI"
                className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-zinc-900 transition hover:bg-zinc-100 disabled:text-zinc-300"
                aria-label="Send"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};

// compact list answer used by assistant chips
export const AnswerList: React.FC<{
  title: string;
  rows: [React.ReactNode, React.ReactNode?][];
  empty?: string;
}> = ({ title, rows, empty = 'Nothing to show yet.' }) => (
  <div className="space-y-1.5">
    <p className="font-medium text-zinc-900">{title}</p>
    {rows.length ? (
      <ul className="space-y-1">
        {rows.map(([a, b], i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{a}</span>
            {b !== undefined ? (
              <span className="shrink-0 tabular-nums text-zinc-500">{b}</span>
            ) : null}
          </li>
        ))}
      </ul>
    ) : (
      <p>{empty}</p>
    )}
  </div>
);
