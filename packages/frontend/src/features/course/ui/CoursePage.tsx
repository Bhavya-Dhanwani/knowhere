import React from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Layers,
  Lock,
  MessagesSquare,
  PenLine,
  Play,
  Trophy
} from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { Badge } from '../../../shared/ui/Badge';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { CourseCover } from '../../../shared/ui/CourseCover';
import { CountUp } from '../../../shared/ui/fx';
import { flattenItems } from '../api/contentApi';
import { useCourseStructure } from '../hooks/useCourseContent';
import { CourseOutline } from './CourseOutline';
import { ITEM_META } from './itemMeta';

const ProgressRing: React.FC<{ pct: number }> = ({ pct }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-white/15" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-white transition-[stroke-dashoffset] duration-1000 ease-out"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-lg font-semibold text-white">
        <CountUp to={pct} suffix="%" />
      </span>
    </div>
  );
};

export const CoursePage: React.FC = () => {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useCourseStructure(id);
  const isStaff = Boolean(data?.canManage);

  if (isLoading) {
    return (
      <div className="page space-y-6 py-6 sm:py-8">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page py-10">
        <EmptyState
          icon={<Lock />}
          title="Couldn't open this course"
          description={(error as Error)?.message}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/courses">
                <Button variant="outline">All courses</Button>
              </Link>
              <Button variant="ghost" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const { course, modules, stats } = data;
  const flat = flattenItems(data);
  const open = flat.filter((f) => !f.module.schedule?.locked);
  const next = open.find((f) => !f.item.completed) || open[0];
  const pct = stats.itemCount ? (stats.completedCount / stats.itemCount) * 100 : 0;
  const started = stats.completedCount > 0;
  const typeCounts = flat.reduce<Record<string, number>>((acc, f) => {
    acc[f.item.type] = (acc[f.item.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page space-y-6 py-6 sm:py-8">
      <Link
        to="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" /> Courses
      </Link>

      {/* hero */}
      <section className="relative overflow-hidden rounded-3xl text-white shadow-lift">
        <CourseCover seed={course.id} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
        <div className="relative flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="dark" size="sm">
                {stats.moduleCount} module{stats.moduleCount === 1 ? '' : 's'}
              </Badge>
              <Badge variant="dark" size="sm">
                {stats.lessonCount} lesson{stats.lessonCount === 1 ? '' : 's'}
              </Badge>
              {course.status !== 'published' ? (
                <Badge variant="amber" size="sm">
                  {course.status}
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-balance break-words text-2xl font-semibold tracking-tight sm:text-4xl">
              {course.title}
            </h1>
            {course.description ? (
              <p className="mt-2 max-w-xl text-pretty text-sm text-white/80 sm:text-base">
                {course.description}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {next ? (
                <Link to={`/course/${course.id}/learn/${next.item.id}`}>
                  <Button className="bg-white text-zinc-900 hover:bg-zinc-100">
                    <Play className="h-4 w-4" /> {started ? 'Continue' : 'Start course'}
                  </Button>
                </Link>
              ) : null}
              {data.enrolled ? (
                <Link to={`/course/${course.id}/community`}>
                  <Button variant="dark">
                    <MessagesSquare className="h-4 w-4" /> Community
                  </Button>
                </Link>
              ) : null}
              {isStaff ? (
                <Link to={`/admin/course/${course.id}`}>
                  <Button variant="dark">
                    <PenLine className="h-4 w-4" /> Edit content
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
          {stats.itemCount ? <ProgressRing pct={pct} /> : null}
        </div>
      </section>

      {!data.enrolled ? (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            You're viewing the syllabus. Lessons, quizzes and the community open once a trainer or
            admin enrolls you in this course.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="min-w-0 space-y-3 lg:col-span-2">
          <h2 className="text-base font-semibold text-zinc-900">Course outline</h2>
          {modules.length ? (
            <CourseOutline courseId={course.id} modules={modules} activeItemId={next?.item.id} />
          ) : (
            <EmptyState
              icon={<Layers />}
              title="No content yet"
              description={
                isStaff
                  ? 'Add the first module from the editor to start building this course.'
                  : 'The trainer is still putting this course together. Check back soon.'
              }
              action={
                isStaff ? (
                  <Link to={`/admin/course/${course.id}`}>
                    <Button>Open editor</Button>
                  </Link>
                ) : undefined
              }
            />
          )}
        </section>

        <aside className="min-w-0 space-y-4">
          {next ? (
            <Link
              to={`/course/${course.id}/learn/${next.item.id}`}
              className="group block rounded-2xl bg-ink p-5 text-white shadow-lift transition hover:-translate-y-0.5"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Up next</p>
              <p className="mt-2 line-clamp-2 font-medium">{next.item.title}</p>
              <p className="mt-1 truncate text-xs text-zinc-400">
                {next.module.title} · {next.lesson.title}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-300">
                Jump in <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ) : null}

          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h3 className="text-sm font-semibold text-zinc-900">What's inside</h3>
            <ul className="mt-3 space-y-2.5">
              {(Object.keys(ITEM_META) as (keyof typeof ITEM_META)[]).map((t) => {
                const M = ITEM_META[t];
                return (
                  <li key={t} className="flex items-center gap-3 text-sm">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-lg ring-1 ring-inset ${M.tint}`}
                    >
                      <M.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1 text-zinc-600">{M.label}</span>
                    <span className="font-medium tabular-nums text-zinc-900">
                      {typeCounts[t] || 0}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4 shadow-card">
              <BookOpen className="h-4 w-4 text-zinc-400" />
              <p className="mt-2 text-xl font-semibold tabular-nums">
                {stats.completedCount}/{stats.itemCount}
              </p>
              <p className="text-xs text-zinc-500">items done</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-card">
              <Trophy className="h-4 w-4 text-zinc-400" />
              <p className="mt-2 text-xl font-semibold tabular-nums">{stats.totalScoreEarned}</p>
              <p className="text-xs text-zinc-500">of {stats.maxScore} pts</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
