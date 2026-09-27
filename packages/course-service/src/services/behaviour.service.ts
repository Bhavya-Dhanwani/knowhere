// Learner behaviour: raw tracking events (UserActivity) + progress + attempts + submissions,
// folded into a per-item and per-course profile, then written out as plain-text documents that
// the coach's retrieval index embeds (coach.service.ts).
import UserActivity from '../shared/models/userActivity.model.js';
import CodeSubmission from '../shared/models/codeSubmission.model.js';
import McqAttempt from '../shared/models/mcqAttempt.model.js';
import CourseProgressDao from '../shared/dao/courseProgress.dao.js';
import { OutlineModule } from './courseOutline.service.js';
import { ScheduledModule } from './schedule.service.js';

type Range = [number, number];

/* ------------------------------------------------------------------ pure helpers (tested) */

// merged, sorted, non-overlapping ranges
export function unionRanges(ranges: Range[]): Range[] {
  const sorted = ranges
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .sort((a, b) => a[0] - b[0]);
  const out: Range[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

const length = (ranges: Range[]) => ranges.reduce((t, [s, e]) => t + (e - s), 0);

export interface VideoStats {
  durationSec: number;
  watchedSec: number;
  uniqueSec: number;
  coveragePct: number;
  repeatSec: number;
  // parts watched more than once (confusion or review), and parts jumped over
  rewatched: Range[];
  skipped: Range[];
  skips: number;
  skippedSec: number;
  rewinds: number;
  pauses: number;
  avgRate: number;
  ended: boolean;
}

// Folds a video's watch ranges and seeks into coverage, repeats and skips.
export function videoStats(input: {
  duration: number;
  watches: { ranges: Range[]; rate?: number }[];
  seeks: { from: number; to: number }[];
  pauses: number;
  ended: boolean;
}): VideoStats {
  const all = input.watches.flatMap((w) => w.ranges);
  const unique = unionRanges(all);
  const watchedSec = length(all);
  const uniqueSec = length(unique);

  // 5-second bins watched at least twice
  const BIN = 5;
  const hits = new Map<number, number>();
  for (const [s, e] of all) {
    for (let b = Math.floor(s / BIN); b * BIN < e; b++) hits.set(b, (hits.get(b) || 0) + 1);
  }
  const rewatched = unionRanges(
    [...hits].filter(([, n]) => n >= 2).map(([b]) => [b * BIN, (b + 1) * BIN] as Range)
  );

  const forward = input.seeks.filter((k) => k.to - k.from > 5);
  const backward = input.seeks.filter((k) => k.from - k.to > 3);
  const skipped = unionRanges(forward.map((k) => [k.from, k.to] as Range));
  const rates = input.watches.map((w) => w.rate || 1);
  const duration = input.duration || Math.max(0, ...unique.map(([, e]) => e));

  return {
    durationSec: Math.round(duration),
    watchedSec: Math.round(watchedSec),
    uniqueSec: Math.round(uniqueSec),
    coveragePct: duration ? Math.min(100, Math.round((uniqueSec / duration) * 100)) : 0,
    repeatSec: Math.round(Math.max(0, watchedSec - uniqueSec)),
    rewatched,
    skipped,
    skips: forward.length,
    skippedSec: Math.round(length(skipped)),
    rewinds: backward.length,
    pauses: input.pauses,
    avgRate: rates.length
      ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100
      : 1,
    ended: input.ended
  };
}

// consecutive events less than 30 minutes apart form one study session
export function sessionsOf(times: number[], gapMs = 30 * 60_000) {
  const sorted = [...times].sort((a, b) => a - b);
  const sessions: { start: number; end: number }[] = [];
  for (const t of sorted) {
    const last = sessions[sessions.length - 1];
    if (last && t - last.end <= gapMs) last.end = t;
    else sessions.push({ start: t, end: t });
  }
  return sessions;
}

export const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
};
const minutes = (sec: number) =>
  sec >= 3600
    ? `${(sec / 3600).toFixed(1)} h`
    : sec >= 60
      ? `${Math.round(sec / 60)} min`
      : `${sec} s`;

/* ------------------------------------------------------------------ profile */

export interface ItemBehaviour {
  itemId: string;
  title: string;
  type: string;
  where: string;
  views: number;
  activeSec: number;
  lastSeen?: string;
  completed: boolean;
  score: number;
  maxScore: number;
  video?: VideoStats;
  mcq?: { attempts: number; correct: number; attemptsToCorrect: number | null };
  code?: {
    runs: number;
    submissions: number;
    accepted: number;
    best: string;
    lastStatus?: string;
    languages: string[];
    pastes: number;
    pastedChars: number;
    resets: number;
  };
  resource?: { opens: number; downloads: number };
}

export interface LearnerProfile {
  userId: string;
  name: string;
  courseId: string;
  courseTitle: string;
  totals: {
    progressPct: number;
    completedItems: number;
    totalItems: number;
    scoreEarned: number;
    maxScore: number;
    activeSec: number;
    activeDays: number;
    sessions: number;
    avgSessionMin: number;
    streakDays: number;
    lastActive: string | null;
    studyTime: Record<'night' | 'morning' | 'afternoon' | 'evening', number>;
    videoCoveragePct: number | null;
    mcqAccuracyPct: number | null;
    codeAcceptRatePct: number | null;
  };
  items: ItemBehaviour[];
  notStarted: { title: string; type: string; due?: string }[];
  signals: string[];
}

type Event = {
  eventType: string;
  itemId?: string | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
};

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export async function buildProfile(args: {
  userId: string;
  name: string;
  courseId: string;
  courseTitle: string;
  outline: OutlineModule[];
  schedule?: ScheduledModule[];
  days?: number;
}): Promise<LearnerProfile> {
  const { userId, courseId, outline } = args;
  const since = new Date(Date.now() - (args.days ?? 120) * 86_400_000);
  const flat = outline.flatMap((m, mi) =>
    m.submodules.flatMap((s) =>
      s.items.map((it) => ({ item: it, module: m, lesson: s, moduleIndex: mi }))
    )
  );
  const mcqIds = flat.filter((f) => f.item.type === 'mcq').map((f) => f.item.refId);
  const codeIds = flat.filter((f) => f.item.type === 'code-question').map((f) => f.item.refId);

  const [events, progress, attempts, submissions] = await Promise.all([
    UserActivity.find({ userId, courseId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .lean<Event[]>(),
    new CourseProgressDao().findProgress(courseId, userId),
    mcqIds.length
      ? McqAttempt.find({ userId, mcqId: { $in: mcqIds } })
          .sort({ createdAt: 1 })
          .lean()
      : Promise.resolve([]),
    codeIds.length
      ? CodeSubmission.find({ userId, courseId }).sort({ createdAt: 1 }).lean()
      : Promise.resolve([])
  ]);

  const done = new Map((progress?.completedItems || []).map((c) => [String(c.contentItemId), c]));
  const byItem = new Map<string, Event[]>();
  for (const e of events) {
    if (!e.itemId) continue;
    if (!byItem.has(e.itemId)) byItem.set(e.itemId, []);
    byItem.get(e.itemId)!.push(e);
  }

  const items: ItemBehaviour[] = [];
  for (const { item, module, lesson } of flat) {
    const evs = byItem.get(item._id) || [];
    const of = (t: string) => evs.filter((e) => e.eventType === t);
    const completion = done.get(item._id);
    const b: ItemBehaviour = {
      itemId: item._id,
      title: item.title,
      type: item.type,
      where: `${module.title} › ${lesson.title}`,
      views: of('ITEM_VIEW').length,
      activeSec: Math.round(
        of('ITEM_DWELL').reduce((t, e) => t + num(e.metadata.activeMs), 0) / 1000
      ),
      lastSeen: evs.length ? evs[evs.length - 1].timestamp.toISOString() : undefined,
      completed: Boolean(completion),
      score: completion ? num((completion as { scoreEarned?: number }).scoreEarned) : 0,
      maxScore: item.maxScore
    };

    if (item.type === 'video') {
      const watches = of('VIDEO_WATCH').map((e) => ({
        ranges: (Array.isArray(e.metadata.ranges) ? e.metadata.ranges : []) as Range[],
        rate: num(e.metadata.rate, 1)
      }));
      if (watches.length || of('VIDEO_SEEK').length) {
        b.video = videoStats({
          duration: Math.max(0, ...evs.map((e) => num(e.metadata.duration))),
          watches,
          seeks: of('VIDEO_SEEK').map((e) => ({
            from: num(e.metadata.from),
            to: num(e.metadata.to)
          })),
          pauses: of('VIDEO_PAUSE').length,
          ended: of('VIDEO_ENDED').length > 0
        });
      }
    } else if (item.type === 'mcq') {
      const mine = (attempts as { mcqId: unknown; isCorrect: boolean }[]).filter(
        (a) => String(a.mcqId) === item.refId
      );
      if (mine.length) {
        const first = mine.findIndex((a) => a.isCorrect);
        b.mcq = {
          attempts: mine.length,
          correct: mine.filter((a) => a.isCorrect).length,
          attemptsToCorrect: first >= 0 ? first + 1 : null
        };
      }
    } else if (item.type === 'code-question') {
      const subs = (
        submissions as {
          itemId: string;
          status: string;
          passed: number;
          total: number;
          language: string;
        }[]
      ).filter((s) => s.itemId === item._id);
      const runs = of('CODE_RUN');
      if (subs.length || runs.length || of('CODE_PASTE').length) {
        const best = subs.reduce(
          (m, s) => (s.total && s.passed / s.total > m.passed / (m.total || 1) ? s : m),
          {
            passed: 0,
            total: 0
          } as { passed: number; total: number }
        );
        b.code = {
          runs: runs.length,
          submissions: subs.length,
          accepted: subs.filter((s) => s.status === 'Accepted').length,
          best: best.total ? `${best.passed}/${best.total}` : '—',
          lastStatus: subs[subs.length - 1]?.status,
          languages: [
            ...new Set(
              [
                ...subs.map((s) => s.language),
                ...runs.map((r) => String(r.metadata.language || ''))
              ].filter(Boolean)
            )
          ],
          pastes: of('CODE_PASTE').length,
          pastedChars: of('CODE_PASTE').reduce((t, e) => t + num(e.metadata.chars), 0),
          resets: of('CODE_RESET').length
        };
      }
    } else if (item.type === 'resource') {
      const opens = of('RESOURCE_OPEN').length;
      const downloads = of('RESOURCE_DOWNLOAD').length;
      if (opens || downloads) b.resource = { opens, downloads };
    }
    items.push(b);
  }

  /* course-level totals */
  const times = events.map((e) => new Date(e.timestamp).getTime());
  const sessions = sessionsOf(times);
  const days = [
    ...new Set(events.map((e) => new Date(e.timestamp).toISOString().slice(0, 10)))
  ].sort();
  let streak = 0;
  for (let d = new Date(); ; d = new Date(d.getTime() - 86_400_000)) {
    if (days.includes(d.toISOString().slice(0, 10))) streak++;
    else if (streak || d.toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10))
      break;
  }
  const studyTime = { night: 0, morning: 0, afternoon: 0, evening: 0 };
  for (const e of events) {
    if (e.eventType !== 'ITEM_DWELL') continue;
    const h = num(e.metadata.localHour, new Date(e.timestamp).getHours());
    const slot = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    studyTime[slot] += Math.round(num(e.metadata.activeMs) / 1000);
  }
  const activeSec = items.reduce((t, i) => t + i.activeSec, 0);
  const videos = items.filter((i) => i.video);
  const mcqs = items.filter((i) => i.mcq);
  const codes = items.filter((i) => i.code && i.code.submissions);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

  const totals: LearnerProfile['totals'] = {
    progressPct: pct(done.size, flat.length) ?? 0,
    completedItems: done.size,
    totalItems: flat.length,
    scoreEarned: progress?.totalScoreEarned || 0,
    maxScore: flat.reduce((t, f) => t + f.item.maxScore, 0),
    activeSec,
    activeDays: days.length,
    sessions: sessions.length,
    avgSessionMin: sessions.length
      ? Math.round(sessions.reduce((t, s) => t + (s.end - s.start), 0) / sessions.length / 60_000)
      : 0,
    streakDays: streak,
    lastActive: times.length ? new Date(Math.max(...times)).toISOString() : null,
    studyTime,
    videoCoveragePct: videos.length
      ? Math.round(videos.reduce((t, v) => t + v.video!.coveragePct, 0) / videos.length)
      : null,
    mcqAccuracyPct: pct(
      mcqs.reduce((t, i) => t + i.mcq!.correct, 0),
      mcqs.reduce((t, i) => t + i.mcq!.attempts, 0)
    ),
    codeAcceptRatePct: pct(
      codes.reduce((t, i) => t + i.code!.accepted, 0),
      codes.reduce((t, i) => t + i.code!.submissions, 0)
    )
  };

  // open modules with untouched items (what they are leaving behind)
  const now = Date.now();
  const notStarted = flat
    .filter(({ item, moduleIndex }) => {
      const s = args.schedule?.[moduleIndex];
      const open = !s || new Date(s.startsAt).getTime() <= now;
      return open && !done.has(item._id) && !(byItem.get(item._id) || []).length;
    })
    .map(({ item, moduleIndex }) => ({
      title: item.title,
      type: item.type,
      due: args.schedule?.[moduleIndex]?.deadline
        ? new Date(args.schedule[moduleIndex].deadline).toISOString().slice(0, 10)
        : undefined
    }));

  return {
    userId,
    name: args.name,
    courseId,
    courseTitle: args.courseTitle,
    totals,
    items,
    notStarted,
    signals: signalsOf(totals, items, notStarted)
  };
}

// deterministic observations the coach builds on (the LLM explains, it does not invent)
function signalsOf(
  t: LearnerProfile['totals'],
  items: ItemBehaviour[],
  notStarted: LearnerProfile['notStarted']
): string[] {
  const s: string[] = [];
  const daysSince = t.lastActive
    ? (Date.now() - new Date(t.lastActive).getTime()) / 86_400_000
    : Infinity;
  if (!Number.isFinite(daysSince)) s.push('Has not started the course yet.');
  else if (daysSince > 7) s.push(`Inactive for ${Math.floor(daysSince)} days.`);
  else if (t.streakDays >= 3) s.push(`On a ${t.streakDays}-day study streak.`);

  const skippy = items.filter(
    (i) => i.video && i.video.skippedSec > 0.25 * (i.video.durationSec || 1)
  );
  if (skippy.length)
    s.push(`Skips large parts of videos (${skippy.map((i) => `"${i.title}"`).join(', ')}).`);
  const fast = items.filter((i) => i.video && i.video.avgRate >= 1.75);
  if (fast.length) s.push(`Watches videos at ${fast[0].video!.avgRate}x or faster.`);
  const rewatch = items.filter((i) => i.video && i.video.repeatSec >= 60);
  if (rewatch.length)
    s.push(
      `Rewatches parts of ${rewatch
        .map(
          (i) =>
            `"${i.title}" (around ${i
              .video!.rewatched.slice(0, 2)
              .map(([a, b]) => `${clock(a)}–${clock(b)}`)
              .join(', ')})`
        )
        .join('; ')}, a sign those parts are hard.`
    );
  const unfinished = items.filter((i) => i.video && i.video.coveragePct < 60 && i.views > 0);
  if (unfinished.length)
    s.push(
      `Leaves videos unfinished (${unfinished.map((i) => `"${i.title}" ${i.video!.coveragePct}%`).join(', ')}).`
    );

  const guessy = items.filter((i) => i.mcq && i.mcq.attempts >= 3);
  if (guessy.length)
    s.push(
      `Needs several attempts on quizzes (${guessy.map((i) => `"${i.title}" ${i.mcq!.attempts} tries`).join(', ')}): possibly guessing.`
    );
  const struggling = items.filter((i) => i.code && i.code.submissions >= 2 && !i.code.accepted);
  if (struggling.length)
    s.push(
      `Stuck on coding problems (${struggling.map((i) => `"${i.title}" ${i.code!.submissions} failed submissions, last: ${i.code!.lastStatus}`).join('; ')}).`
    );
  const noRuns = items.filter((i) => i.code && i.code.submissions > 0 && i.code.runs === 0);
  if (noRuns.length) s.push('Submits code without running the examples first.');
  const pasted = items.filter((i) => i.code && i.code.pastedChars > 200);
  if (pasted.length)
    s.push(
      `Pastes large blocks of code into the editor (${pasted.map((i) => `"${i.title}" ${i.code!.pastedChars} chars`).join(', ')}).`
    );
  if (t.mcqAccuracyPct !== null && t.mcqAccuracyPct < 50)
    s.push(`Quiz accuracy is low (${t.mcqAccuracyPct}%).`);

  const night = t.studyTime.night;
  const total = Object.values(t.studyTime).reduce((a, b) => a + b, 0);
  if (total > 1800 && night / total > 0.4) s.push('Studies mostly late at night (00:00–05:00).');
  if (t.sessions >= 3 && t.avgSessionMin < 10)
    s.push(`Short study sessions (about ${t.avgSessionMin} min on average).`);
  if (notStarted.length >= 3) s.push(`${notStarted.length} items in open modules not started yet.`);
  return s;
}

/* ------------------------------------------------------------------ documents for retrieval */

export interface CoachDoc {
  kind: string;
  itemId?: string;
  title: string;
  text: string;
}

export function profileDocuments(p: LearnerProfile): CoachDoc[] {
  const t = p.totals;
  const slot = Object.entries(t.studyTime).sort((a, b) => b[1] - a[1])[0];
  const docs: CoachDoc[] = [
    {
      kind: 'summary',
      title: `${p.name}: overview`,
      text:
        `${p.name} in "${p.courseTitle}": ${t.progressPct}% complete (${t.completedItems}/${t.totalItems} items), ` +
        `score ${t.scoreEarned}/${t.maxScore}. Focused study time ${minutes(t.activeSec)} over ${t.activeDays} active days ` +
        `and ${t.sessions} sessions (about ${t.avgSessionMin} min each), current streak ${t.streakDays} days, ` +
        `last active ${t.lastActive ? t.lastActive.slice(0, 10) : 'never'}.` +
        (slot && slot[1] ? ` Studies mostly in the ${slot[0]}.` : '') +
        (t.videoCoveragePct !== null ? ` Average video coverage ${t.videoCoveragePct}%.` : '') +
        (t.mcqAccuracyPct !== null ? ` Quiz accuracy ${t.mcqAccuracyPct}%.` : '') +
        (t.codeAcceptRatePct !== null
          ? ` ${t.codeAcceptRatePct}% of code submissions accepted.`
          : '')
    }
  ];
  if (p.signals.length) {
    docs.push({
      kind: 'signals',
      title: `${p.name}: behaviour signals`,
      text: `Observed behaviour of ${p.name}: ${p.signals.join(' ')}`
    });
  }
  if (p.notStarted.length) {
    docs.push({
      kind: 'not-started',
      title: `${p.name}: not started`,
      text: `${p.name} has not started: ${p.notStarted
        .map((n) => `${n.type} "${n.title}"${n.due ? ` (due ${n.due})` : ''}`)
        .join('; ')}.`
    });
  }
  for (const i of p.items) {
    const parts: string[] = [];
    if (i.views || i.activeSec)
      parts.push(`opened ${i.views} times, ${minutes(i.activeSec)} focused`);
    if (i.video) {
      const v = i.video;
      parts.push(
        `watched ${v.coveragePct}% of ${clock(v.durationSec)} (${clock(v.uniqueSec)} unique, ${clock(v.watchedSec)} total)` +
          (v.repeatSec
            ? `, rewatched ${clock(v.repeatSec)}${
                v.rewatched.length
                  ? ` around ${v.rewatched
                      .slice(0, 3)
                      .map(([a, b]) => `${clock(a)}–${clock(b)}`)
                      .join(', ')}`
                  : ''
              }`
            : '') +
          (v.skips
            ? `, skipped ${v.skips} times (${clock(v.skippedSec)}${
                v.skipped.length
                  ? `: ${v.skipped
                      .slice(0, 3)
                      .map(([a, b]) => `${clock(a)}–${clock(b)}`)
                      .join(', ')}`
                  : ''
              })`
            : '') +
          (v.rewinds ? `, rewound ${v.rewinds} times` : '') +
          (v.pauses ? `, paused ${v.pauses} times` : '') +
          `, average speed ${v.avgRate}x, ${v.ended ? 'finished' : 'not finished'}`
      );
    }
    if (i.mcq) {
      parts.push(
        `${i.mcq.attempts} quiz attempts, ${i.mcq.correct} correct` +
          (i.mcq.attemptsToCorrect
            ? `, right on attempt ${i.mcq.attemptsToCorrect}`
            : ', never answered correctly')
      );
    }
    if (i.code) {
      const c = i.code;
      parts.push(
        `${c.runs} runs, ${c.submissions} submissions (${c.accepted} accepted, best ${c.best}${c.lastStatus ? `, last ${c.lastStatus}` : ''})` +
          (c.languages.length ? ` in ${c.languages.join('/')}` : '') +
          (c.pastes ? `, pasted ${c.pastedChars} chars of code in ${c.pastes} pastes` : '') +
          (c.resets ? `, reset the editor ${c.resets} times` : '')
      );
    }
    if (i.resource)
      parts.push(
        `opened the file ${i.resource.opens} times, downloaded ${i.resource.downloads} times`
      );
    if (!parts.length) continue;
    docs.push({
      kind: 'item',
      itemId: i.itemId,
      title: `${p.name}: ${i.title}`,
      text: `${p.name} on ${i.type} "${i.title}" (${i.where}): ${parts.join('; ')}. ${i.completed ? `Completed, ${i.score}/${i.maxScore} points.` : 'Not completed.'}`
    });
  }
  return docs;
}
