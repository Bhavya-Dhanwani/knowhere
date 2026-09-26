import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import { useQueries, useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Plus, Sparkles, Target, Users } from 'lucide-react';
import { RootState } from '../../../app/store';
import { lmsApi } from '../../../shared/api/lms';
import { firstName, greeting } from '../../../shared/lib/format';
import { PageHeader, StatCard } from '../../../shared/layout/PageHeader';
import { Button } from '../../../shared/ui/Button';
import { Badge } from '../../../shared/ui/Badge';
import { Avatar } from '../../../shared/ui/Avatar';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { CourseCover } from '../../../shared/ui/CourseCover';
import { Dropdown } from '../../../shared/ui/Dropdown';
import { CountUp } from '../../../shared/ui/fx';
import { CreateCourseModal } from '../../admin/ui/CreateCourseModal';

export const TrainerDashboard: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const [creating, setCreating] = useState(false);

  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: lmsApi.myProfile });
  const courses = useQuery({ queryKey: ['courses'], queryFn: lmsApi.listCourses });

  // a trainer "teaches" courses they created or were assigned to as trainer/admin
  const teaching = useMemo(() => {
    const staffOf = new Set(
      (profile.data?.memberships || []).filter((m) => m.role !== 'trainee').map((m) => m.courseId)
    );
    return (courses.data || []).filter((c) => c.instructorId === user?.id || staffOf.has(c.id));
  }, [courses.data, profile.data, user?.id]);

  const grades = useQueries({
    queries: teaching.map((c) => ({
      queryKey: ['grades', c.id],
      queryFn: () => lmsApi.courseGrades(c.id),
      staleTime: 60_000
    }))
  });

  const learners = grades.reduce((s, g) => s + (g.data?.totalStudents || 0), 0);
  const allRows = grades.flatMap((g) => g.data?.grades || []);
  const avg = allRows.length ? allRows.reduce((s, r) => s + r.percentage, 0) / allRows.length : 0;
  const drafts = teaching.filter((c) => c.status === 'draft').length;

  const [selected, setSelected] = useState<string>('');
  const activeId = selected || teaching[0]?.id || '';
  const activeGrades = grades[teaching.findIndex((c) => c.id === activeId)]?.data;

  const loading = profile.isLoading || courses.isLoading;

  return (
    <div className="page space-y-6 py-6 sm:space-y-8 sm:py-8">
      <PageHeader
        eyebrow="Trainer workspace"
        title={`${greeting()}, ${firstName(user?.name)}`}
        description="Your cohorts at a glance — who's moving, who's stuck, and what to ship next."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New course
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Courses taught"
          icon={<BookOpen />}
          value={loading ? '—' : <CountUp to={teaching.length} />}
        />
        <StatCard
          label="Active learners"
          icon={<Users />}
          value={loading ? '—' : <CountUp to={learners} />}
        />
        <StatCard
          label="Avg. completion"
          icon={<Target />}
          value={loading ? '—' : <CountUp to={avg} suffix="%" />}
        />
        <StatCard
          label="Drafts"
          icon={<Sparkles />}
          value={loading ? '—' : <CountUp to={drafts} />}
          hint="Unpublished courses"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="min-w-0 space-y-4 xl:col-span-3">
          <h2 className="text-base font-semibold text-zinc-900">Your courses</h2>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : teaching.length ? (
            <ul className="space-y-3">
              {teaching.map((c, i) => {
                const g = grades[i]?.data;
                const rows = g?.grades || [];
                const pct = rows.length
                  ? rows.reduce((s, r) => s + r.percentage, 0) / rows.length
                  : 0;
                return (
                  <li key={c.id}>
                    <Link
                      to={`/course/${c.id}`}
                      className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card transition hover:shadow-lift sm:gap-4"
                    >
                      <CourseCover
                        seed={c.id}
                        className="hidden h-14 w-20 shrink-0 rounded-xl xs:block"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate text-sm font-medium text-zinc-900">
                            {c.title}
                          </p>
                          <Badge
                            size="sm"
                            variant={c.status === 'published' ? 'green' : 'gray'}
                            dot
                          >
                            {c.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <ProgressBar value={pct} height="sm" className="max-w-[180px]" />
                          <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                            {g ? `${g.totalStudents} learners` : '…'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<GraduationCap />}
              title="No courses yet"
              description="Create your first course, or ask an admin to add you as a trainer on an existing one."
              action={
                <Button onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> New course
                </Button>
              }
            />
          )}
        </section>

        <section className="min-w-0 space-y-4 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900">Leaderboard</h2>
            {teaching.length > 1 ? (
              <Dropdown
                value={activeId}
                onChange={setSelected}
                options={teaching.map((c) => ({ value: c.id, label: c.title }))}
                containerClassName="max-w-[200px]"
              />
            ) : null}
          </div>
          <Leaderboard
            rows={activeGrades?.grades || []}
            loading={!activeGrades && teaching.length > 0}
          />
        </section>
      </div>

      <CreateCourseModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
};

const Leaderboard: React.FC<{
  rows: { userId: string; percentage: number; totalScoreEarned: number }[];
  loading: boolean;
}> = ({ rows, loading }) => {
  const top = [...rows].sort((a, b) => b.totalScoreEarned - a.totalScoreEarned).slice(0, 8);
  const profiles = useQueries({
    queries: top.map((r) => ({
      queryKey: ['profile', r.userId],
      queryFn: () => lmsApi.getProfile(r.userId),
      staleTime: 5 * 60_000,
      retry: false
    }))
  });

  if (loading) return <Skeleton className="h-72" />;
  if (!top.length)
    return (
      <EmptyState
        icon={<Users />}
        title="No learner activity yet"
        description="Scores appear here as learners complete content."
      />
    );

  return (
    <ol className="divide-y divide-zinc-100 rounded-2xl bg-white shadow-card">
      {top.map((r, i) => {
        const name = profiles[i]?.data?.name || `Learner ${r.userId.slice(-4)}`;
        return (
          <li key={r.userId} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-zinc-400">
              {i + 1}
            </span>
            <Avatar name={name} src={profiles[i]?.data?.avatar} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-900">{name}</span>
            <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-500">
              {Math.round(r.percentage)}%
            </span>
          </li>
        );
      })}
    </ol>
  );
};
