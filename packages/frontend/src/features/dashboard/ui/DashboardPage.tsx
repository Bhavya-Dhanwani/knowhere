import React from 'react';
import { Link, Navigate } from 'react-router';
import { useSelector } from 'react-redux';
import {
  BookOpen,
  CheckCircle2,
  Compass,
  FileCode2,
  MessagesSquare,
  Target,
  Trophy
} from 'lucide-react';
import { RootState } from '../../../app/store';
import { roleOf } from '../../../shared/lib/roles';
import { firstName, greeting } from '../../../shared/lib/format';
import { PageHeader, StatCard } from '../../../shared/layout/PageHeader';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { Button } from '../../../shared/ui/Button';
import { CountUp } from '../../../shared/ui/fx';
import { useLearnerOverview } from '../hooks/useLearnerOverview';
import { ActivityHeatmap } from './ActivityHeatmap';
import { LearnerCourseCard } from './LearnerCourseCard';
import { TrainerDashboard } from './TrainerDashboard';

// `/dashboard` is role-aware: admins go to the console, trainers get the teaching view.
export const DashboardPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const role = roleOf(user);
  if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'trainer') return <TrainerDashboard />;
  return <StudentDashboard />;
};

const quickLinks = [
  { to: '/chat', label: 'Community chat', desc: 'Ask your cohort', icon: MessagesSquare },
  { to: '/courses', label: 'Browse courses', desc: 'Find something new', icon: Compass },
  { to: '/docs', label: 'API reference', desc: 'Build on Knowhere', icon: FileCode2 }
];

const StudentDashboard: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const { isLoading, error, enrolled, discover, activity, refetch } = useLearnerOverview();

  const avg = enrolled.length
    ? enrolled.reduce((s, c) => s + (c.progress?.percentage || 0), 0) / enrolled.length
    : 0;
  const completed = enrolled.reduce((s, c) => s + (c.progress?.completedItemsCount || 0), 0);
  const points = enrolled.reduce((s, c) => s + (c.progress?.totalScoreEarned || 0), 0);

  return (
    <div className="page space-y-6 py-6 sm:space-y-8 sm:py-8">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })}
        title={`${greeting()}, ${firstName(user?.name)}`}
        description="Here's where you left off. Small steps every day compound."
        actions={
          <Link to="/courses">
            <Button variant="outline" size="md">
              <BookOpen className="h-4 w-4" /> All courses
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Enrolled courses"
          icon={<BookOpen />}
          value={isLoading ? '—' : <CountUp to={enrolled.length} />}
        />
        <StatCard
          label="Average progress"
          icon={<Target />}
          value={isLoading ? '—' : <CountUp to={avg} suffix="%" />}
        />
        <StatCard
          label="Items completed"
          icon={<CheckCircle2 />}
          value={isLoading ? '—' : <CountUp to={completed} />}
        />
        <StatCard
          label="Points earned"
          icon={<Trophy />}
          value={isLoading ? '—' : <CountUp to={points} />}
        />
      </div>

      {error ? (
        <EmptyState
          title="Couldn't load your courses"
          description={(error as Error).message}
          action={
            <Button variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="min-w-0 space-y-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Continue learning</h2>
            {enrolled.length ? (
              <span className="text-xs text-zinc-500">{enrolled.length} active</span>
            ) : null}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : enrolled.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {enrolled.map((c, i) => (
                <LearnerCourseCard key={c.id} course={c} progress={c.progress} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen />}
              title="You're not enrolled yet"
              description="Once a trainer or admin adds you to a cohort, it will show up here."
              action={
                <Link to="/courses">
                  <Button variant="outline">Explore courses</Button>
                </Link>
              }
            />
          )}

          {!isLoading && discover.length ? (
            <div className="pt-4">
              <h2 className="mb-4 text-base font-semibold text-zinc-900">Discover</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {discover.slice(0, 4).map((c, i) => (
                  <LearnerCourseCard key={c.id} course={c} index={i} cta="Preview" />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-4">
          <ActivityHeatmap timestamps={activity} />
          <div className="rounded-2xl bg-white p-2 shadow-card">
            {quickLinks.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-zinc-50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600">
                  <q.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900">
                    {q.label}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">{q.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
