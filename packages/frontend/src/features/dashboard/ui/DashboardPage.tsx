import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Bell, BookOpen, Compass, MessagesSquare, Search } from 'lucide-react';
import { RootState } from '../../../app/store';
import { roleOf } from '../../../shared/lib/roles';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { Button } from '../../../shared/ui/Button';
import { CourseCover } from '../../../shared/ui/CourseCover';
import { communityApi } from '../../chat/api/communityApi';
import { fmtTime } from '../../chat/ui/bits';
import { ActivityHeatmap } from './ActivityHeatmap';
import { TrainerDashboard } from './TrainerDashboard';
import { LearnerCourse, useLearnerOverview } from '../hooks/useLearnerOverview';

// `/dashboard` is role-aware: admins go to the console, trainers get the teaching view.
export const DashboardPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const role = roleOf(user);
  if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'trainer') return <TrainerDashboard />;
  return <StudentDashboard />;
};

type Sort = 'recent' | 'oldest' | 'progress';
const SORTS: Record<Sort, string> = {
  recent: 'Newest first',
  oldest: 'Oldest first',
  progress: 'Most progress'
};

// Student home: one "Classroom" card of enrolled courses; notifications and the heatmap beside it.
const StudentDashboard: React.FC = () => {
  const { isLoading, error, enrolled, discover, activity, refetch } = useLearnerOverview();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const pct = (c: LearnerCourse) => Math.round(c.progress?.percentage || 0);
  const when = (c: LearnerCourse) => new Date(c.enrolledAt || c.createdAt || 0).getTime();

  const rows = enrolled
    .filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) =>
      sort === 'progress'
        ? pct(b) - pct(a)
        : sort === 'oldest'
          ? when(a) - when(b)
          : when(b) - when(a)
    );

  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 px-3 py-5 sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/60 px-5 py-4">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Classroom</h1>
          <div className="flex gap-2">
            <Link to="/courses">
              <Button size="sm" variant="outline">
                <Compass className="h-4 w-4" /> Browse courses
              </Button>
            </Link>
            <Link to="/chat">
              <Button size="sm">
                <MessagesSquare className="h-4 w-4" /> Community
              </Button>
            </Link>
          </div>
        </header>

        <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-medium text-zinc-900">Your enrolled courses</h2>
            <div className="flex gap-2">
              <label className="relative flex-1 sm:w-56 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  aria-label="Search your courses"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
                />
              </label>
              <label className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  aria-label="Sort courses"
                  className="h-10 appearance-none rounded-xl border border-zinc-200 bg-white pl-3 pr-9 text-sm text-zinc-700 outline-none focus:border-zinc-400"
                >
                  {(Object.keys(SORTS) as Sort[]).map((k) => (
                    <option key={k} value={k}>
                      {SORTS[k]}
                    </option>
                  ))}
                </select>
                <ArrowUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              </label>
            </div>
          </div>

          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {(error as Error).message}
              <Button size="sm" variant="outline" onClick={refetch}>
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))}
            </div>
          ) : rows.length ? (
            <ul className="custom-scrollbar -mr-2 max-h-[560px] space-y-3 overflow-y-auto pr-2">
              {rows.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200/80 transition hover:border-zinc-300 sm:flex-row"
                >
                  <Link to={`/course/${c.id}`} className="shrink-0 sm:w-64" tabIndex={-1}>
                    <CourseCover
                      seed={c.id}
                      title={c.title}
                      className="aspect-[16/6] h-full w-full sm:aspect-auto"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <Link
                          to={`/course/${c.id}`}
                          className="line-clamp-2 text-lg font-semibold tracking-tight text-zinc-900 hover:underline sm:text-xl"
                        >
                          {c.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-500">
                          {c.enrolledAt
                            ? `Enrolled on ${new Date(c.enrolledAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
                            : 'Enrolled'}
                        </p>
                        <p className="text-sm text-zinc-500">Progress {pct(c)}%</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Link to={`/course/${c.id}`}>
                          <Button size="sm">{pct(c) ? 'Resume learning' : 'Start learning'}</Button>
                        </Link>
                        <Link to={`/course/${c.id}/community`}>
                          <Button size="sm" variant="outline">
                            Open community
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <div className="mt-auto h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-zinc-900 transition-all duration-700"
                        style={{ width: `${pct(c)}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-3 font-medium text-zinc-900">
                {enrolled.length
                  ? 'No course matches your search'
                  : 'You are not enrolled in a course yet'}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {enrolled.length
                  ? 'Try a different name.'
                  : 'Pick one from the catalog to get started.'}
              </p>
              {!enrolled.length ? (
                <Link to="/courses" className="mt-4 inline-block">
                  <Button size="sm">Browse courses</Button>
                </Link>
              ) : null}
            </div>
          )}

          {discover.length && !isLoading ? (
            <div className="mt-6 border-t border-zinc-100 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-medium text-zinc-900">More to explore</h2>
                <Link to="/courses" className="text-sm text-zinc-500 hover:text-zinc-900">
                  View all
                </Link>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {discover.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/course/${c.id}`}
                      className="flex items-center gap-3 rounded-xl border border-zinc-200/80 p-2 pr-3 transition hover:border-zinc-300"
                    >
                      <CourseCover seed={c.id} className="h-12 w-16 shrink-0 rounded-lg" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                        {c.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="min-w-0 space-y-5 xl:sticky xl:top-20 xl:self-start">
        <NotificationsCard />
        <ActivityHeatmap timestamps={activity} />
      </aside>
    </div>
  );
};

const NotificationsCard: React.FC = () => {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['notifications'], queryFn: communityApi.notifications });
  const items = q.data?.items || [];
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      <h3 className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-4 text-lg font-semibold tracking-tight text-zinc-900">
        All notifications
      </h3>
      {q.isLoading ? (
        <Skeleton className="m-4 h-24" />
      ) : items.length ? (
        <ul className="custom-scrollbar max-h-80 divide-y divide-zinc-100 overflow-y-auto">
          {items.slice(0, 20).map((n) => (
            <li key={n._id}>
              <button
                onClick={() => navigate(`/course/${n.courseId}/community?c=${n.roomId}`)}
                className="flex w-full gap-3 px-5 py-3 text-left transition hover:bg-zinc-50"
              >
                <span
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.readAt ? '' : 'bg-zinc-900'}`}
                />
                <span className="min-w-0 flex-1 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">{n.actorName}</span> {n.text}
                  <span className="block text-xs text-zinc-400">{fmtTime(n.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-6 py-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-zinc-300" strokeWidth={1.5} />
          <p className="mt-3 font-medium text-zinc-900">No notifications available</p>
          <p className="mt-1 text-sm text-zinc-500">
            You&apos;re all caught up! Check back later for updates.
          </p>
        </div>
      )}
    </section>
  );
};
