// AI coach: retrieval-augmented chat over learner behaviour (behaviour.service.ts) and course
// content. Documents are embedded with mistral-embed and stored in Mongo; retrieval is scoped by
// who is asking (a trainee only ever sees their own behaviour).
import crypto from 'node:crypto';
import { AuthUser, KeyPool } from '@lms/shared';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import CoachDocument from '../shared/models/coachDocument.model.js';
import McqDao from '../shared/dao/mcq.dao.js';
import CodeQuestionDao from '../shared/dao/codeQuestion.dao.js';
import { ICourseDocument } from '../shared/models/course.model.js';
import Forbidden from '../shared/errors/Forbidden.error.js';
import NotFound from '../shared/errors/NotFound.error.js';
import logger from '../shared/config/logger.config.js';
import { loadCourseOutline, OutlineModule } from './courseOutline.service.js';
import { canManageCourse, memberships, requireCourse, scheduleFor } from './access.service.js';
import { buildProfile, CoachDoc, LearnerProfile, profileDocuments } from './behaviour.service.js';
import mistralGeneratorService from './mistralGenerator.service.js';

const pool = KeyPool.fromEnv('MISTRAL');
const sha = (s: string) => crypto.createHash('sha1').update(s).digest('hex');

async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 32) {
    const batch = texts.slice(i, i + 32);
    out.push(
      ...(await pool.run((apiKey) =>
        new MistralAIEmbeddings({ apiKey, model: 'mistral-embed', maxRetries: 0 }).embedDocuments(
          batch
        )
      ))
    );
  }
  return out;
}

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// Writes a scope's documents, embedding only the ones whose text changed; removes stale ones.
async function syncDocs(courseId: string, userId: string | null, docs: CoachDoc[]) {
  const keyOf = (d: CoachDoc) => `${courseId}:${userId ?? 'course'}:${d.kind}:${d.itemId ?? ''}`;
  const wanted = new Map(docs.map((d) => [keyOf(d), { ...d, hash: sha(d.title + d.text) }]));
  const existing = await CoachDocument.find({ courseId, userId }).select('key hash').lean();
  const have = new Map(existing.map((e) => [e.key, e.hash]));
  const changed = [...wanted].filter(([k, d]) => have.get(k) !== d.hash);

  if (changed.length) {
    const vectors = await embed(changed.map(([, d]) => `${d.title}\n${d.text}`));
    await CoachDocument.bulkWrite(
      changed.map(([key, d], i) => ({
        updateOne: {
          filter: { key },
          update: {
            $set: {
              key,
              courseId,
              userId,
              kind: d.kind,
              itemId: d.itemId ?? null,
              title: d.title,
              text: d.text,
              hash: d.hash,
              embedding: vectors[i]
            }
          },
          upsert: true
        }
      }))
    );
  }
  const stale = existing.map((e) => e.key).filter((k) => !wanted.has(k));
  if (stale.length) await CoachDocument.deleteMany({ key: { $in: stale } });
}

/* ------------------------------------------------------------------ indexing */

// ponytail: in-memory freshness per pod; a shared cache only matters with many replicas
const fresh = new Map<string, { at: number; profile?: LearnerProfile }>();
const LEARNER_TTL = 2 * 60_000;
const COURSE_TTL = 30 * 60_000;

async function indexCourse(course: ICourseDocument, outline: OutlineModule[]) {
  const key = `course:${course._id}`;
  if (Date.now() - (fresh.get(key)?.at || 0) < COURSE_TTL) return;
  const items = outline.flatMap((m) =>
    m.submodules.flatMap((s) => s.items.map((it) => ({ it, where: `${m.title} › ${s.title}` })))
  );
  const [mcqs, codes] = await Promise.all([
    new McqDao().findMcqsByIds(items.filter((x) => x.it.type === 'mcq').map((x) => x.it.refId)),
    new CodeQuestionDao().findQuestionsByIds(
      items.filter((x) => x.it.type === 'code-question').map((x) => x.it.refId)
    )
  ]);
  const detail = new Map<string, string>([
    ...mcqs.map((q) => [String(q._id), `Question: ${q.question}`] as [string, string]),
    ...codes.map(
      (q) =>
        [String(q._id), `${q.difficulty} problem. ${q.description.slice(0, 600)}`] as [
          string,
          string
        ]
    )
  ]);
  const docs: CoachDoc[] = [
    {
      kind: 'syllabus',
      title: `${course.title}: syllabus`,
      text: `Course "${course.title}". ${course.description || ''} Modules: ${outline
        .map((m, i) => `${i + 1}. ${m.title} (${m.submodules.map((s) => s.title).join(', ')})`)
        .join('; ')}.`
    },
    ...items.map(({ it, where }) => ({
      kind: 'content',
      itemId: it._id,
      title: `${it.type} "${it.title}"`,
      text: `${it.type} "${it.title}" in ${where}, worth ${it.maxScore} points. ${detail.get(it.refId) || ''}`.trim()
    }))
  ];
  await syncDocs(String(course._id), null, docs);
  fresh.set(key, { at: Date.now() });
}

async function learnerProfile(
  course: ICourseDocument,
  outline: OutlineModule[],
  userId: string,
  name: string
): Promise<LearnerProfile> {
  const key = `learner:${course._id}:${userId}`;
  const hit = fresh.get(key);
  if (hit?.profile && Date.now() - hit.at < LEARNER_TTL) return hit.profile;

  const courseId = String(course._id);
  const member = await memberships.memberOf(courseId, userId);
  const joinedAt = member?.assignedAt ? new Date(member.assignedAt) : course.createdAt;
  const profile = await buildProfile({
    userId,
    name,
    courseId,
    courseTitle: course.title,
    outline,
    schedule: await scheduleFor(courseId, outline, userId, joinedAt)
  });
  await syncDocs(courseId, userId, profileDocuments(profile));
  fresh.set(key, { at: Date.now(), profile });
  return profile;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

/* ------------------------------------------------------------------ scope */

export type CoachMode = 'trainee' | 'learner' | 'cohort';

interface Scope {
  course: ICourseDocument;
  outline: OutlineModule[];
  mode: CoachMode;
  role: string;
  learnerId?: string;
  names: Map<string, string>;
}

// ponytail: cohort mode looks at the first 60 learners; page through them for bigger cohorts
const COHORT_CAP = 60;

async function resolveScope(user: AuthUser, courseId: string, learnerId?: string): Promise<Scope> {
  const course = await requireCourse(courseId);
  const staff = await canManageCourse(user, course);
  if (!staff && !(await memberships.memberOf(courseId, user.userId))) {
    throw new Forbidden('You are not enrolled in this course.');
  }
  const outline = await loadCourseOutline(course);

  if (!staff) {
    // trainees only ever get their own behaviour, whatever they ask for
    return {
      course,
      outline,
      mode: 'trainee',
      role: 'trainee',
      learnerId: user.userId,
      names: new Map([[user.userId, user.name || 'you']])
    };
  }

  const members = (await memberships.members(courseId)).filter((m) => m.role === 'trainee');
  if (learnerId && !members.some((m) => m.userId === learnerId)) {
    throw new NotFound('That learner is not enrolled in this course.');
  }
  const ids = learnerId ? [learnerId] : members.slice(0, COHORT_CAP).map((m) => m.userId);
  const profiles = await memberships.profiles(ids).catch(() => []);
  const names = new Map(
    ids.map((id) => [id, profiles.find((p) => p.userId === id)?.name || `Learner ${id.slice(-4)}`])
  );
  return {
    course,
    outline,
    mode: learnerId ? 'learner' : 'cohort',
    role: user.role === 'admin' ? 'admin' : 'trainer',
    learnerId,
    names
  };
}

async function profilesFor(scope: Scope) {
  const ids = scope.learnerId ? [scope.learnerId] : [...scope.names.keys()];
  return mapLimit(ids, 6, (id) =>
    learnerProfile(scope.course, scope.outline, id, scope.names.get(id) || 'Learner')
  );
}

/* ------------------------------------------------------------------ insights (UI cards) */

export async function coachInsights(user: AuthUser, courseId: string, learnerId?: string) {
  const scope = await resolveScope(user, courseId, learnerId);
  const profiles = await profilesFor(scope);
  if (scope.mode !== 'cohort') return { mode: scope.mode, profile: profiles[0] };
  const risk = (p: LearnerProfile) => {
    const idle = p.totals.lastActive
      ? (Date.now() - new Date(p.totals.lastActive).getTime()) / 86_400_000
      : Infinity;
    return idle > 7 || p.signals.some((s) => /Stuck|low|not started/i.test(s))
      ? 'high'
      : p.signals.length >= 2
        ? 'medium'
        : 'low';
  };
  return {
    mode: scope.mode,
    roster: profiles
      .map((p) => ({
        userId: p.userId,
        name: p.name,
        progressPct: p.totals.progressPct,
        activeSec: p.totals.activeSec,
        lastActive: p.totals.lastActive,
        signals: p.signals.slice(0, 3),
        risk: risk(p)
      }))
      .sort(
        (a, b) =>
          ['high', 'medium', 'low'].indexOf(a.risk) - ['high', 'medium', 'low'].indexOf(b.risk)
      )
  };
}

/* ------------------------------------------------------------------ chat */

const PERSONA: Record<CoachMode, (s: Scope) => string> = {
  trainee: (s) =>
    `You are Knowhere Coach, the personal practice coach of ${s.names.get(s.learnerId!)} in the course "${s.course.title}".
The context holds their tracked behaviour (time on each item, videos watched, skipped and rewatched parts with timestamps, playback speed, quiz attempts, coding runs and submissions, pastes, study times and streaks) and the course content.
Answer their question with a concrete, prioritised practice plan: what to do next, which items to revisit by exact title (with video timestamps when relevant), how to practise (for example: pause and re-derive instead of rewatching, run the examples before submitting, write code instead of pasting), and when and how long to study.
Be warm, direct and specific. Speak to them as "you". Use short sections and bullet points. Base every claim on the context; if the data is thin, say so and suggest how to start. Never mention other learners.`,
  learner: (s) =>
    `You are Knowhere Mentor, advising a ${s.role} about one learner, ${s.names.get(s.learnerId!)}, in "${s.course.title}".
From the tracked behaviour in the context, explain what is going on with evidence (numbers, item titles, timestamps), what the learner most likely struggles with or is doing well, and exactly how to talk to them: the tone to use, what to praise first, what to ask, what to avoid saying, and a short ready-to-send message.
Then suggest concrete interventions (items to assign or revisit, a focus for a 1:1, pacing). Be specific, kind and professional. Use only the context; never invent activity.`,
  cohort: (s) =>
    `You are Knowhere Mentor, advising a ${s.role} about the cohort of "${s.course.title}".
Using the roster and behaviour in the context, identify who needs attention and why (with evidence), the common trouble spots (items many learners rewatch, skip, fail or leave unstarted), and how to address both the group and individuals: suggested messages, session topics and pacing changes.
Be specific and practical, use names and item titles, and use only the context.`
};

async function prepareCoach(
  user: AuthUser,
  input: {
    courseId: string;
    learnerId?: string;
    message: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }
) {
  const scope = await resolveScope(user, input.courseId, input.learnerId);
  const courseId = String(scope.course._id);
  const [profiles] = await Promise.all([
    profilesFor(scope),
    indexCourse(scope.course, scope.outline).catch((err) =>
      logger.warn({ err, courseId }, 'Coach: course index failed')
    )
  ]);

  // retrieve: the focused learner's docs + course content, or the whole cohort
  const filter =
    scope.mode === 'cohort'
      ? { courseId }
      : { courseId, userId: { $in: [scope.learnerId!, null] } };
  const candidates = await CoachDocument.find(filter)
    .select('title text kind embedding userId')
    .lean();
  let top = candidates.slice(0, 12);
  try {
    const [q] = await embed([input.message]);
    top = candidates
      .map((c) => ({ c, score: cosine(q, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 14)
      .map((x) => x.c);
  } catch (err) {
    logger.warn({ err }, 'Coach: query embedding failed; using unranked context');
  }

  // always ground on the summary and signals, whatever the retrieval picked
  const always =
    scope.mode === 'cohort'
      ? profiles
          .map(
            (p) =>
              `- ${p.name}: ${p.totals.progressPct}% done, ${Math.round(p.totals.activeSec / 60)} min focused, last active ${p.totals.lastActive?.slice(0, 10) || 'never'}${p.signals.length ? `; ${p.signals.slice(0, 3).join(' ')}` : ''}`
          )
          .join('\n')
      : profileDocuments(profiles[0])
          .filter((d) => d.kind === 'summary' || d.kind === 'signals' || d.kind === 'not-started')
          .map((d) => d.text)
          .join('\n');

  const context = top.map((d, i) => `[${i + 1}] ${d.title}: ${d.text}`).join('\n');
  const messages: BaseMessage[] = [
    new SystemMessage(PERSONA[scope.mode](scope)),
    ...(input.history || [])
      .slice(-8)
      .map((h) =>
        h.role === 'assistant'
          ? new AIMessage(h.content.slice(0, 4000))
          : new HumanMessage(h.content.slice(0, 2000))
      ),
    new HumanMessage(
      `${scope.mode === 'cohort' ? 'Roster' : 'Learner overview'}:\n${always || '(no activity yet)'}\n\nRetrieved context:\n${context || '(none)'}\n\nQuestion: ${input.message}`
    )
  ];
  return {
    mode: scope.mode,
    messages,
    sources: top.slice(0, 6).map((d) => ({ title: d.title, kind: d.kind }))
  };
}

type CoachInput = Parameters<typeof prepareCoach>[1];

export async function coachChat(user: AuthUser, input: CoachInput) {
  const { mode, messages, sources } = await prepareCoach(user, input);
  return { mode, answer: await mistralGeneratorService.chat(messages), sources };
}

// same retrieval, streamed: `meta` carries the mode and sources before the first token
export async function coachStream(user: AuthUser, input: CoachInput) {
  const { mode, messages, sources } = await prepareCoach(user, input);
  return { meta: { mode, sources }, events: mistralGeneratorService.stream(messages) };
}
