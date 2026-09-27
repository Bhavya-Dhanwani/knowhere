import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { Bot, Loader2, SendHorizontal, Sparkles } from 'lucide-react';
import { RootState } from '../../../app/store';
import { roleOf } from '../../../shared/lib/roles';
import { cn } from '../../../shared/lib/cn';
import { lmsApi } from '../../../shared/api/lms';
import { Markdown } from '../../../shared/ui/Markdown';
import { postStream } from '../../../shared/lib/sse';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { Avatar } from '../../../shared/ui/Avatar';
import {
  CoachAnswer,
  contentApi,
  LearnerProfileView,
  RosterRow
} from '../../course/api/contentApi';

type Turn = { role: 'user' | 'assistant'; content: string; sources?: CoachAnswer['sources'] };

const SUGGESTIONS = {
  trainee: [
    'How should I practise this week?',
    'Which videos should I rewatch, and which parts?',
    'Why do I keep failing the coding problems?',
    'Make me a 30-minute daily study plan'
  ],
  learner: [
    'How should I talk to this learner?',
    'What is this learner struggling with?',
    'Write a short encouraging message I can send',
    'What should I assign them next?'
  ],
  cohort: [
    'Who needs my attention this week, and why?',
    'Which content are learners struggling with?',
    'What should the next live session cover?',
    'Draft a message to the whole cohort'
  ]
};

const minutes = (sec: number) =>
  sec >= 3600
    ? `${(sec / 3600).toFixed(1)} h`
    : sec >= 60
      ? `${Math.round(sec / 60)} min`
      : `${sec} s`;

export const CoachPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const role = roleOf(user);
  const staff = role !== 'student';

  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: lmsApi.myProfile });
  const courses = useQuery({ queryKey: ['courses'], queryFn: lmsApi.listCourses });

  // trainees coach on courses they are in; trainers on courses they teach; admins on all
  const options = useMemo(() => {
    const mine = profile.data?.memberships || [];
    const all = courses.data || [];
    if (role === 'admin') return all;
    if (role === 'trainer') {
      const teaching = new Set(mine.filter((m) => m.role !== 'trainee').map((m) => m.courseId));
      return all.filter((c) => c.instructorId === user?.id || teaching.has(c.id));
    }
    const enrolled = new Set(mine.map((m) => m.courseId));
    return all.filter((c) => enrolled.has(c.id));
  }, [courses.data, profile.data, role, user?.id]);

  const [courseId, setCourseId] = useState('');
  const [learnerId, setLearnerId] = useState('');
  useEffect(() => {
    if (!courseId && options[0]) setCourseId(options[0].id);
  }, [options, courseId]);

  const insights = useQuery({
    queryKey: ['coach-insights', courseId, learnerId],
    queryFn: () => contentApi.coachInsights(courseId, learnerId || undefined),
    enabled: Boolean(courseId),
    staleTime: 60_000
  });
  // the cohort roster doubles as the learner picker
  const roster = useQuery({
    queryKey: ['coach-insights', courseId, ''],
    queryFn: () => contentApi.coachInsights(courseId),
    enabled: Boolean(courseId && staff),
    staleTime: 60_000
  });
  const learners =
    roster.data && roster.data.mode === 'cohort' ? roster.data.roster : ([] as RosterRow[]);

  const mode: keyof typeof SUGGESTIONS = !staff ? 'trainee' : learnerId ? 'learner' : 'cohort';
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => setTurns([]), [courseId, learnerId]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [turns.length, busy]);

  const ask = async (text: string) => {
    const message = text.trim();
    if (!message || busy || !courseId) return;
    setDraft('');
    const history = turns.map(({ role: r, content }) => ({ role: r, content }));
    setTurns((t) => [...t, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
    setBusy(true);
    // the reply streams into the last turn
    const patch = (fn: (last: Turn) => Turn) =>
      setTurns((t) => [...t.slice(0, -1), fn(t[t.length - 1])]);
    try {
      await postStream(
        '/course/coach/chat/stream',
        { courseId, learnerId: learnerId || undefined, message, history },
        {
          onMeta: (m) => patch((l) => ({ ...l, sources: (m as CoachAnswer).sources })),
          onToken: (text) => patch((l) => ({ ...l, content: l.content + text })),
          onRestart: () => patch((l) => ({ ...l, content: '' }))
        }
      );
    } catch (e) {
      patch((l) => ({ ...l, content: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const focusName =
    insights.data && insights.data.mode !== 'cohort' ? insights.data.profile.name : undefined;

  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 px-3 py-5 sm:px-6 sm:py-6 xl:grid-cols-[400px_minmax(0,1fr)]">
      {/* ---------------- context + behaviour */}
      <aside className="min-w-0 space-y-5 xl:sticky xl:top-20 xl:self-start">
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-900">
            <Sparkles className="h-5 w-5" /> AI Coach
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {staff
              ? 'Understand each learner from how they actually study, and how to talk to them.'
              : 'Personal practice advice from how you actually study.'}
          </p>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-zinc-500">
              Course
              <select
                value={courseId}
                aria-label="Coach course"
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setLearnerId('');
                }}
                className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                {options.length ? null : <option value="">No courses yet</option>}
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            {staff ? (
              <label className="block text-xs font-medium text-zinc-500">
                Learner
                <select
                  value={learnerId}
                  aria-label="Coach learner"
                  onChange={(e) => setLearnerId(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value="">Whole cohort</option>
                  {learners.map((l) => (
                    <option key={l.userId} value={l.userId}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </section>

        {insights.isLoading ? (
          <Skeleton className="h-80 rounded-2xl" />
        ) : insights.error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {(insights.error as Error).message}
          </p>
        ) : insights.data?.mode === 'cohort' ? (
          <Roster rows={insights.data.roster} onPick={setLearnerId} />
        ) : insights.data ? (
          <Profile p={insights.data.profile} self={!staff} />
        ) : null}
      </aside>

      {/* ---------------- chat */}
      <section className="flex min-h-[70vh] min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white xl:h-[calc(100dvh-7rem)]">
        <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-5 py-3.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-white">
            <Bot className="h-4 w-4" />
          </span>
          <p className="text-[15px] font-semibold text-zinc-900">
            {mode === 'trainee'
              ? 'Your practice coach'
              : mode === 'learner'
                ? `Mentor on ${focusName || 'this learner'}`
                : 'Cohort mentor'}
          </p>
        </div>

        <div
          className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5"
          aria-live="polite"
        >
          {!turns.length ? (
            <div className="mx-auto max-w-xl py-8 text-center">
              <p className="text-lg font-semibold text-zinc-900">
                {mode === 'trainee'
                  ? 'What do you want to get better at?'
                  : 'Ask about your learners'}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Answers come from tracked behaviour: what was watched, skipped and rewatched, quiz
                attempts, code runs and submissions, and study habits.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS[mode].map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    disabled={!courseId}
                    className="rounded-full border border-zinc-200 px-3.5 py-2 text-sm text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {turns
            .filter((t) => t.role === 'user' || t.content)
            .map((t, i) => (
              <div key={i} className={cn('flex', t.role === 'user' && 'justify-end')}>
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-4 py-3 text-sm',
                    t.role === 'user'
                      ? 'rounded-tr-md bg-zinc-900 text-white'
                      : 'rounded-tl-md bg-zinc-50 text-zinc-800 ring-1 ring-inset ring-zinc-200/70'
                  )}
                >
                  {t.role === 'assistant' ? (
                    <div className="prose-sm">
                      <Markdown>{t.content}</Markdown>
                    </div>
                  ) : (
                    t.content
                  )}
                  {t.sources?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-200/70 pt-2.5">
                      {t.sources.map((s, k) => (
                        <span
                          key={k}
                          className="rounded-md bg-white px-2 py-0.5 text-[11px] text-zinc-500 ring-1 ring-inset ring-zinc-200"
                        >
                          {s.title}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          {busy && !turns[turns.length - 1]?.content ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the behaviour data…
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
            placeholder={mode === 'trainee' ? 'Ask your coach…' : 'Ask about your learners…'}
            maxLength={2000}
            aria-label="Ask the AI coach"
            className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={!draft.trim() || busy || !courseId}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-800 disabled:bg-zinc-200"
            aria-label="Send"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </form>
      </section>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-inset ring-zinc-200/70">
    <p className="text-[11px] text-zinc-500">{label}</p>
    <p className="mt-0.5 font-semibold tabular-nums text-zinc-900">{value}</p>
  </div>
);

const Profile: React.FC<{ p: LearnerProfileView; self: boolean }> = ({ p, self }) => {
  const t = p.totals;
  const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-5">
      <div className="flex items-center gap-3">
        <Avatar name={p.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium text-zinc-900">{self ? 'Your behaviour' : p.name}</p>
          <p className="text-xs text-zinc-500">
            Last active {t.lastActive ? new Date(t.lastActive).toLocaleDateString() : 'never'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Progress" value={`${t.progressPct}%`} />
        <Stat label="Focused time" value={minutes(t.activeSec)} />
        <Stat label="Active days" value={String(t.activeDays)} />
        <Stat label="Streak" value={`${t.streakDays} d`} />
        <Stat label="Video coverage" value={pct(t.videoCoveragePct)} />
        <Stat label="Quiz accuracy" value={pct(t.mcqAccuracyPct)} />
        <Stat label="Code accepted" value={pct(t.codeAcceptRatePct)} />
        <Stat label="Avg session" value={`${t.avgSessionMin} min`} />
      </div>
      {p.signals.length ? (
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-900">What we noticed</p>
          <ul className="space-y-1.5 text-sm text-zinc-600">
            {p.signals.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Not enough activity yet to spot patterns.</p>
      )}
      {p.notStarted.length ? (
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-900">Not started yet</p>
          <ul className="custom-scrollbar max-h-40 space-y-1 overflow-y-auto text-sm text-zinc-600">
            {p.notStarted.map((n) => (
              <li key={n.title} className="flex justify-between gap-3">
                <span className="truncate">{n.title}</span>
                {n.due ? <span className="shrink-0 text-xs text-zinc-400">due {n.due}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};

const riskTone = {
  high: 'bg-red-50 text-red-700 ring-red-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-200'
};

const Roster: React.FC<{ rows: RosterRow[]; onPick: (id: string) => void }> = ({
  rows,
  onPick
}) => (
  <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
    <p className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3.5 text-sm font-medium text-zinc-900">
      Learners ({rows.length})
    </p>
    {rows.length ? (
      <ul className="custom-scrollbar max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto">
        {rows.map((r) => (
          <li key={r.userId}>
            <button
              onClick={() => onPick(r.userId)}
              className="w-full px-5 py-3 text-left transition hover:bg-zinc-50"
            >
              <span className="flex items-center gap-2.5">
                <Avatar name={r.name} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                  {r.name}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset',
                    riskTone[r.risk]
                  )}
                >
                  {r.risk}
                </span>
              </span>
              <span className="mt-1 block text-xs text-zinc-500">
                {r.progressPct}% · {minutes(r.activeSec)} focused · last active{' '}
                {r.lastActive ? new Date(r.lastActive).toLocaleDateString() : 'never'}
              </span>
              {r.signals[0] ? (
                <span className="mt-1 block truncate text-xs text-zinc-400">{r.signals[0]}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="px-5 py-8 text-center text-sm text-zinc-500">No learners enrolled yet.</p>
    )}
  </section>
);
