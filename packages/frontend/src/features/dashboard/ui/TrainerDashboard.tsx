import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import { useQueries, useQuery } from '@tanstack/react-query';
import { BookOpen, Plus, Target, Users } from 'lucide-react';
import { RootState } from '../../../app/store';
import { lmsApi } from '../../../shared/api/lms';
import { firstName } from '../../../shared/lib/format';
import {
  AnswerList,
  AssistantChip,
  AssistantPanel,
  DashboardGrid,
  Greeting,
  Panel,
  StatTile
} from '../../../shared/layout/DashboardKit';
import { Button } from '../../../shared/ui/Button';
import { Badge } from '../../../shared/ui/Badge';
import { Avatar } from '../../../shared/ui/Avatar';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { Dropdown } from '../../../shared/ui/Dropdown';
import { CreateCourseModal } from '../../admin/ui/CreateCourseModal';

export const TrainerDashboard: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

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
  // default to the course with the most learners: an empty draft makes a dull leaderboard
  const busiest = teaching.reduce<{ id: string; n: number }>(
    (best, c, i) => {
      const n = grades[i]?.data?.totalStudents ?? 0;
      return n > best.n ? { id: c.id, n } : best;
    },
    { id: teaching[0]?.id || '', n: -1 }
  ).id;
  const activeId = selected || busiest;
  const activeGrades = grades[teaching.findIndex((c) => c.id === activeId)]?.data;

  const loading = profile.isLoading || courses.isLoading;
  const pctOf = (i: number) => {
    const rows = grades[i]?.data?.grades || [];
    return rows.length ? Math.round(rows.reduce((t, r) => t + r.percentage, 0) / rows.length) : 0;
  };

  const facts = [
    `Courses taught: ${teaching.map((c, i) => `${c.title} (${c.status}, ${grades[i]?.data?.totalStudents ?? 0} learners, ${pctOf(i)}% average completion)`).join('; ') || 'none'}.`,
    `Total learners: ${learners}. Average completion: ${Math.round(avg)}%. Draft courses: ${drafts}.`
  ].join('\n');

  const chips: AssistantChip[] = [
    {
      label: 'Learners per course',
      answer: () => (
        <AnswerList
          title={`${learners} learners`}
          rows={teaching.map((c, i) => [c.title, grades[i]?.data?.totalStudents ?? 0])}
        />
      )
    },
    {
      label: 'Average completion',
      answer: () => (
        <AnswerList
          title={`${Math.round(avg)}% across your courses`}
          rows={teaching.map((c, i) => [c.title, `${pctOf(i)}%`])}
        />
      )
    },
    {
      label: 'Drafts to publish',
      answer: () => (
        <AnswerList
          title={`${drafts} draft${drafts === 1 ? '' : 's'}`}
          rows={teaching.filter((c) => c.status === 'draft').map((c) => [c.title])}
          empty="Everything you teach is published."
        />
      )
    }
  ];

  return (
    <DashboardGrid aside={<AssistantPanel chips={chips} facts={facts} />}>
      <Greeting
        name={firstName(user?.name)}
        subtitle="Your cohorts at a glance: who is moving, who is stuck, what to ship next."
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New course
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          icon={<BookOpen />}
          value={loading ? null : teaching.length}
          label="Courses taught"
          to="/courses"
        />
        <StatTile icon={<Users />} value={loading ? null : learners} label="Active learners" />
        <StatTile
          icon={<Target />}
          value={loading ? null : Math.round(avg)}
          suffix="%"
          label="Avg. completion"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Your courses" viewAll="/courses">
          {loading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : teaching.length ? (
            <ul className="space-y-1">
              {teaching.map((c, i) => (
                <li key={c.id}>
                  <Link
                    to={`/admin/course/${c.id}`}
                    className="block rounded-xl px-2 py-2.5 transition hover:bg-zinc-50"
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                        {c.title}
                      </span>
                      <Badge size="sm" variant={c.status === 'published' ? 'green' : 'gray'} dot>
                        {c.status}
                      </Badge>
                    </span>
                    <span className="mt-2 flex items-center gap-3">
                      <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <span
                          className="block h-full rounded-full bg-zinc-900"
                          style={{ width: `${pctOf(i)}%` }}
                        />
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                        {grades[i]?.data ? `${grades[i]!.data!.totalStudents} learners` : '…'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3 text-sm text-zinc-500">
              No courses yet. Create one, or ask an admin to add you as a trainer.
            </p>
          )}
        </Panel>

        <Panel title="Leaderboard">
          {teaching.length > 1 ? (
            <div className="px-2 pb-2">
              <Dropdown
                value={activeId}
                onChange={setSelected}
                options={teaching.map((c) => ({ value: c.id, label: c.title }))}
              />
            </div>
          ) : null}
          <Leaderboard
            rows={activeGrades?.grades || []}
            loading={!activeGrades && teaching.length > 0}
          />
        </Panel>
      </div>

      <CreateCourseModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(course) => navigate(`/admin/course/${course.id}`)}
      />
    </DashboardGrid>
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
    <ol className="divide-y divide-zinc-100">
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
