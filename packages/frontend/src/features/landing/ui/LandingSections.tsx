import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bot,
  CalendarClock,
  Check,
  Code2,
  GraduationCap,
  ListChecks,
  MessagesSquare,
  Presentation,
  ShieldCheck,
  Trophy,
  Video
} from 'lucide-react';
import { Reveal, SpotlightCard } from '../../../shared/ui/fx';
import { cn } from '../../../shared/lib/cn';

export const SectionHeading: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
}> = ({ eyebrow, title, body }) => (
  <Reveal className="mx-auto max-w-2xl text-center">
    <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">{eyebrow}</p>
    <h2 className="mt-3 text-balance text-[1.75rem] font-medium leading-[1.1] tracking-tight text-white xs:text-4xl sm:text-5xl">
      {title}
    </h2>
    {body ? (
      <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-zinc-400 sm:text-base">
        {body}
      </p>
    ) : null}
  </Reveal>
);

/* ------------------------------------------------------------------ bento */

const CodeVisual = () => (
  <div className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-black/40 font-mono text-[11px] leading-5 sm:text-xs">
    <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2 text-zinc-500">
      <Code2 className="h-3.5 w-3.5" /> two_sum.ts
    </div>
    <pre className="overflow-x-auto p-3 text-zinc-300">
      <span className="text-brand-300">function</span> <span className="text-sky-300">twoSum</span>
      (nums, target) {'{\n'}
      {'  '}
      <span className="text-brand-300">const</span> seen ={' '}
      <span className="text-brand-300">new</span> Map();{'\n'}
      {'  '}
      <span className="text-zinc-500">{'// …'}</span>
      {'\n}'}
    </pre>
    <div className="space-y-1 border-t border-white/5 p-3">
      {['[2,7,11,15], 9', '[3,2,4], 6', '[3,3], 6'].map((t, i) => (
        <motion.div
          key={t}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.2 }}
          className="flex items-center gap-2 text-[11px]"
        >
          <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
            <Check className="h-2.5 w-2.5" />
          </span>
          <span className="truncate text-zinc-400">{t}</span>
          <span className="ml-auto text-emerald-400">passed</span>
        </motion.div>
      ))}
    </div>
  </div>
);

const ReviewVisual = () => (
  <div className="mt-6 space-y-2.5">
    {[
      { k: 'Architecture', v: 86 },
      { k: 'Code quality', v: 74 },
      { k: 'Requirements met', v: 92 }
    ].map((r, i) => (
      <div key={r.k}>
        <div className="mb-1 flex justify-between text-xs text-zinc-400">
          <span>{r.k}</span>
          <span className="tabular-nums text-zinc-300">{r.v}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-fuchsia-400"
            initial={{ width: 0 }}
            whileInView={{ width: `${r.v}%` }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.15, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    ))}
  </div>
);

const ChatVisual = () => (
  <div className="mt-6 space-y-2">
    {[
      { who: 'Maya', text: 'anyone got the redis pub/sub part working?', me: false },
      { who: 'You', text: 'yep — check #system-design, pinned it', me: true },
      { who: 'Leo', text: 'lifesaver 🙌', me: false }
    ].map((m, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 + i * 0.25 }}
        className={cn('flex', m.me && 'justify-end')}
      >
        <span
          className={cn(
            'max-w-[85%] rounded-2xl px-3 py-2 text-xs',
            m.me
              ? 'rounded-br-md bg-brand-600 text-white'
              : 'rounded-bl-md bg-white/[0.07] text-zinc-300'
          )}
        >
          {!m.me ? <span className="mb-0.5 block text-[10px] text-zinc-500">{m.who}</span> : null}
          {m.text}
        </span>
      </motion.div>
    ))}
  </div>
);

const features = [
  {
    icon: Code2,
    title: 'Coding practice that grades itself',
    body: 'Trainers write the problem; AI drafts the test cases. Learners get instant, per-case feedback.',
    visual: <CodeVisual />,
    span: 'md:col-span-2 lg:col-span-2 lg:row-span-2'
  },
  {
    icon: Bot,
    title: 'AI project reviews',
    body: 'Submissions are discovered, analysed and scored against your rubric — with evidence.',
    visual: <ReviewVisual />,
    span: 'lg:col-span-2'
  },
  {
    icon: CalendarClock,
    title: 'Cohort-aware deadlines',
    body: 'Modules unlock on schedule or on progress. Late joiners get a fair catch-up window.',
    span: ''
  },
  {
    icon: Video,
    title: 'Protected video',
    body: 'Byte-range streaming with a DRM pipeline behind it.',
    span: ''
  },
  {
    icon: MessagesSquare,
    title: 'Real-time community',
    body: 'Channels per course, presence, and message history. Discord-style, built in.',
    visual: <ChatVisual />,
    span: 'md:col-span-2 lg:col-span-2'
  },
  {
    icon: Trophy,
    title: 'Progress you can feel',
    body: 'Activity heatmaps, streaks and leaderboards keep momentum visible.',
    span: ''
  },
  {
    icon: ShieldCheck,
    title: 'Role-based by design',
    body: 'Platform roles plus per-course ARBAC for admins, trainers and learners.',
    span: ''
  }
];

export const FeatureBento: React.FC = () => (
  <div className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 sm:gap-4">
    {features.map((f, i) => (
      <Reveal key={f.title} delay={Math.min(i, 4) * 0.06} className={f.span}>
        <SpotlightCard className="h-full rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20 sm:p-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-brand-300">
            <f.icon className="h-5 w-5" />
          </span>
          <h3 className="mt-5 text-lg font-medium tracking-tight text-white">{f.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
          {f.visual}
        </SpotlightCard>
      </Reveal>
    ))}
  </div>
);

/* ------------------------------------------------------------------ roles */

const roles = [
  {
    id: 'student',
    label: 'Students',
    icon: GraduationCap,
    headline: 'Everything for the day, in one calm place.',
    points: [
      'A dashboard that picks up exactly where you stopped',
      'Videos, MCQs and coding challenges inside each lesson',
      'Streaks, heatmaps and a leaderboard for your cohort',
      'Submit projects and get structured AI feedback'
    ]
  },
  {
    id: 'trainer',
    label: 'Trainers',
    icon: Presentation,
    headline: 'Spend time teaching, not administrating.',
    points: [
      'Build courses from modules, submodules and content items',
      'Let AI draft coding test cases from a problem statement',
      'See per-learner completion and scores at a glance',
      'Run review events with rubric-based evaluation'
    ]
  },
  {
    id: 'admin',
    label: 'Admins',
    icon: ShieldCheck,
    headline: 'Run the whole academy from one console.',
    points: [
      'Create, publish and archive courses',
      'Enrol people and assign course roles in seconds',
      'Promote trainers and admins platform-wide',
      'Microservices on Kubernetes that scale per workload'
    ]
  }
];

export const RoleTabs: React.FC = () => {
  const [active, setActive] = useState(roles[0].id);
  const role = roles.find((r) => r.id === active)!;

  return (
    <div className="mx-auto mt-12 max-w-4xl">
      <div className="mx-auto flex w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => setActive(r.id)}
            className={cn(
              'relative flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm transition-colors',
              active === r.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {active === r.id ? (
              <motion.span
                layoutId="role-tab"
                className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-inset ring-white/10"
                transition={{ type: 'spring', stiffness: 450, damping: 36 }}
              />
            ) : null}
            <r.icon className="relative hidden h-4 w-4 xs:block" />
            <span className="relative truncate">{r.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={role.id}
          initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
          transition={{ duration: 0.35 }}
          className="mt-8 grid items-center gap-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-5 sm:p-8 md:grid-cols-2"
        >
          <div>
            <h3 className="text-balance text-2xl font-medium tracking-tight text-white sm:text-3xl">
              {role.headline}
            </h3>
          </div>
          <ul className="space-y-3">
            {role.points.map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                className="flex items-start gap-3 text-sm text-zinc-300"
              >
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-300">
                  <Check className="h-3 w-3" />
                </span>
                {p}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------ steps */

const steps = [
  {
    icon: ListChecks,
    title: 'Design the course',
    body: 'Modules, lessons, videos, quizzes and coding problems — with release rules.'
  },
  {
    icon: GraduationCap,
    title: 'Enrol the cohort',
    body: 'Add learners and trainers per course. Everyone lands in the right workspace.'
  },
  {
    icon: Bot,
    title: 'Learn, build, get reviewed',
    body: 'Learners practice daily and submit projects for AI-assisted review.'
  }
];

export const Steps: React.FC = () => (
  <ol className="relative mt-14 grid gap-4 md:grid-cols-3">
    <div className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent md:block" />
    {steps.map((s, i) => (
      <Reveal key={s.title} delay={i * 0.12}>
        <li className="relative">
          <span className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-night text-brand-300 shadow-[0_0_30px_-6px] shadow-brand-500/40">
            <s.icon className="h-5 w-5" />
          </span>
          <p className="mt-5 font-mono text-xs text-zinc-500">0{i + 1}</p>
          <h3 className="mt-1 text-lg font-medium text-white">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
        </li>
      </Reveal>
    ))}
  </ol>
);
