import React from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Layers, Lock, MessagesSquare, PenLine, Play, Trophy } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Avatar } from '../../../shared/ui/Avatar';
import { lmsApi } from '../../../shared/api/lms';
import { cn } from '../../../shared/lib/cn';
import { contentApi, flattenItems } from '../api/contentApi';
import { structureKey, useCourseStructure } from '../hooks/useCourseContent';
import { CourseOutline } from './CourseOutline';
import { CourseCertificatePanel } from '../../certificate/ui/CourseCertificatePanel';

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 1 : 2).replace(/\.?0+$/, '')}k` : String(n);

export const CoursePage: React.FC = () => {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useCourseStructure(id);
  const qc = useQueryClient();
  // open enrollment for published courses; the structure refetch unlocks the lessons
  const enroll = useMutation({
    mutationFn: () => contentApi.enroll(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: structureKey(id) });
      qc.invalidateQueries({ queryKey: ['me', 'profile'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['leaderboard', id] });
    }
  });
  const isStaff = Boolean(data?.canManage);
  const canSeeBoard = Boolean(data && (data.enrolled || isStaff));

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-[1440px] gap-5 px-3 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
        <Skeleton className="h-[560px] rounded-2xl" />
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
  const lessons = modules.flatMap((m) => m.lessons);
  const lessonsDone = lessons.filter(
    (l) => l.items.length && l.items.every((i) => i.completed)
  ).length;
  const modulesDone = modules.filter((m) => {
    const items = m.lessons.flatMap((l) => l.items);
    return items.length && items.every((i) => i.completed);
  }).length;

  return (
    <div
      className={cn(
        'mx-auto grid max-w-[1440px] grid-cols-1 gap-5 px-3 py-5 sm:px-6 sm:py-6',
        canSeeBoard && 'lg:grid-cols-[minmax(0,1fr)_420px]'
      )}
    >
      <div className="min-w-0 space-y-5">
        {/* summary */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/dashboard"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
              {course.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              {next && data.enrolled ? (
                <Link to={`/course/${course.id}/learn/${next.item.id}`}>
                  <Button size="sm">
                    <Play className="h-4 w-4" />{' '}
                    {stats.completedCount ? 'Resume learning' : 'Start course'}
                  </Button>
                </Link>
              ) : null}
              {data.enrolled || isStaff ? (
                <Link to={`/course/${course.id}/community`}>
                  <Button size="sm" variant="outline">
                    <MessagesSquare className="h-4 w-4" /> Community
                  </Button>
                </Link>
              ) : null}
              {isStaff ? (
                <Link to={`/admin/course/${course.id}`}>
                  <Button size="sm" variant="outline">
                    <PenLine className="h-4 w-4" /> Edit content
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>

          {data.enrolled || isStaff ? (
            <div className="mt-4 rounded-xl border border-zinc-200/80 p-4 sm:p-5">
              <p className="text-sm font-medium text-zinc-900">
                {pct.toFixed(pct % 1 ? 2 : 0)}% complete
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-zinc-900 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap justify-between gap-x-6 gap-y-2 text-sm text-zinc-500">
                <span>
                  Modules:{' '}
                  <b className="font-semibold text-zinc-900">
                    {modulesDone}/{modules.length}
                  </b>
                </span>
                <span>
                  Lessons:{' '}
                  <b className="font-semibold text-zinc-900">
                    {lessonsDone}/{lessons.length}
                  </b>
                </span>
                <span>
                  Score:{' '}
                  <b className="font-semibold text-zinc-900">
                    {compact(stats.totalScoreEarned)}/{compact(stats.maxScore)}
                  </b>
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-200/80 p-4 text-sm text-zinc-700 sm:flex-row sm:items-center">
              <Lock className="h-4 w-4 shrink-0 text-zinc-400" />
              <p className="flex-1">
                You're viewing the syllabus. Enroll to unlock lessons, quizzes, coding problems and
                the course community.
              </p>
              <Button size="sm" isLoading={enroll.isPending} onClick={() => enroll.mutate()}>
                Enroll in this course
              </Button>
              {enroll.error ? (
                <p className="text-red-600">{(enroll.error as Error).message}</p>
              ) : null}
            </div>
          )}
          {data.enrolled && !isStaff ? (
            <CourseCertificatePanel courseId={course.id} completedCount={stats.completedCount} />
          ) : null}
        </section>

        {/* modules */}
        <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
          <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-5 py-3.5 text-sm font-medium text-zinc-900">
            <Layers className="h-4 w-4" /> All modules
          </div>
          {modules.length ? (
            <div className="custom-scrollbar max-h-[620px] overflow-y-auto">
              <CourseOutline courseId={course.id} modules={modules} activeItemId={next?.item.id} />
            </div>
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
      </div>

      {canSeeBoard ? <Leaderboard courseId={course.id} /> : null}
    </div>
  );
};

const podiumStyle = [
  'h-24 bg-zinc-200 text-zinc-900', // 2nd
  'h-32 bg-zinc-900 text-white', // 1st
  'h-20 bg-zinc-100 text-zinc-900' // 3rd
];

const Leaderboard: React.FC<{ courseId: string }> = ({ courseId }) => {
  const q = useQuery({
    queryKey: ['leaderboard', courseId],
    queryFn: () => lmsApi.courseLeaderboard(courseId),
    staleTime: 60_000
  });
  const top = q.data?.top || [];
  const profiles = useQueries({
    queries: top.map((r) => ({
      queryKey: ['profile', r.userId],
      queryFn: () => lmsApi.getProfile(r.userId),
      staleTime: 5 * 60_000,
      retry: false
    }))
  });
  const nameOf = (i: number) => profiles[i]?.data?.name || `Learner ${top[i].userId.slice(-4)}`;
  // podium order: 2nd, 1st, 3rd
  const podium = [1, 0, 2].filter((i) => top[i]);

  return (
    <aside className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start">
      <h2 className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-5 py-3.5 text-sm font-medium text-zinc-900">
        <Trophy className="h-4 w-4" /> Leaderboard
      </h2>
      {q.isLoading ? (
        <Skeleton className="m-4 h-72" />
      ) : !top.length ? (
        <EmptyState
          icon={<Trophy />}
          title="No scores yet"
          description="Complete lessons, quizzes and problems to climb the board."
        />
      ) : (
        <>
          <div className="flex items-end justify-center gap-3 px-5 pt-6">
            {podium.map((i) => (
              <div key={top[i].userId} className="flex w-24 flex-col items-center gap-2 sm:w-28">
                <Avatar name={nameOf(i)} src={profiles[i]?.data?.avatar} size="md" />
                <span className="w-full truncate text-center text-sm font-medium text-zinc-900">
                  {nameOf(i).split(' ')[0]}
                </span>
                <div
                  className={cn(
                    'flex w-full flex-col items-center justify-end gap-1 rounded-t-xl pb-3',
                    podiumStyle[[1, 0, 2].indexOf(i)]
                  )}
                >
                  <span className="text-sm font-semibold">{['1st', '2nd', '3rd'][i]}</span>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-zinc-700">
                    {compact(top[i].totalScoreEarned)} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_4rem_5rem] bg-zinc-100 px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <span>Name</span>
            <span className="text-center">Rank</span>
            <span className="text-right">Points</span>
          </div>
          <ol className="custom-scrollbar max-h-[360px] min-h-0 flex-1 divide-y divide-zinc-100 overflow-y-auto">
            {top.slice(3).map((r, k) => (
              <li
                key={r.userId}
                className="grid grid-cols-[1fr_4rem_5rem] items-center px-5 py-2.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={nameOf(k + 3)} src={profiles[k + 3]?.data?.avatar} size="xs" />
                  <span className="truncate text-zinc-900">{nameOf(k + 3)}</span>
                </span>
                <span className="text-center tabular-nums text-zinc-500">{r.rank}</span>
                <span className="text-right font-medium tabular-nums text-zinc-900">
                  {compact(r.totalScoreEarned)}
                </span>
              </li>
            ))}
            {top.length <= 3 ? (
              <li className="px-5 py-4 text-center text-sm text-zinc-400">
                Everyone with a score is on the podium.
              </li>
            ) : null}
          </ol>
          {q.data?.me ? (
            <p className="border-t border-zinc-100 px-5 py-3.5 text-center text-sm text-zinc-600">
              You are <b className="text-zinc-900">#{q.data.me.rank}</b>, ahead of{' '}
              <b className="text-zinc-900">{q.data.me.aheadOf}%</b> of students in this batch
            </p>
          ) : null}
        </>
      )}
    </aside>
  );
};
