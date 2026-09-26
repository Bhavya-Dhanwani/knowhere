import React, { useDeferredValue, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  BookOpen,
  Eye,
  GraduationCap,
  MoreHorizontal,
  PenLine,
  Plus,
  Presentation,
  Search,
  Shield,
  Users
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { RootState } from '../../../app/store';
import { BackendRole, Course, CourseStatus, PlatformUser, lmsApi } from '../../../shared/api/lms';
import { PageHeader, StatCard } from '../../../shared/layout/PageHeader';
import { Button } from '../../../shared/ui/Button';
import { Badge } from '../../../shared/ui/Badge';
import { Avatar } from '../../../shared/ui/Avatar';
import { Input } from '../../../shared/ui/Input';
import { Dropdown } from '../../../shared/ui/Dropdown';
import { Tabs } from '../../../shared/ui/Tabs';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { CourseCover } from '../../../shared/ui/CourseCover';
import { CountUp } from '../../../shared/ui/fx';
import { timeAgo } from '../../../shared/lib/format';
import { cn } from '../../../shared/lib/cn';
import { CreateCourseModal } from './CreateCourseModal';
import { CourseMembersModal } from './CourseMembersModal';

type Section = 'overview' | 'courses' | 'people';

const sectionFromPath = (p: string): Section =>
  p.startsWith('/admin/courses')
    ? 'courses'
    : p.startsWith('/admin/people')
      ? 'people'
      : 'overview';

const statusVariant: Record<CourseStatus, 'green' | 'gray' | 'amber'> = {
  published: 'green',
  draft: 'gray',
  archived: 'amber'
};

const roleMeta: Record<BackendRole, { label: string; icon: typeof Users; color: string }> = {
  trainee: { label: 'Students', icon: GraduationCap, color: 'bg-brand-500' },
  trainer: { label: 'Trainers', icon: Presentation, color: 'bg-sky-500' },
  admin: { label: 'Admins', icon: Shield, color: 'bg-emerald-500' }
};

export const AdminDashboardPage: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = sectionFromPath(pathname);
  const [creating, setCreating] = useState(false);

  const courses = useQuery({ queryKey: ['courses'], queryFn: lmsApi.listCourses });
  const users = useQuery({ queryKey: ['users', ''], queryFn: () => lmsApi.listUsers() });

  return (
    <div className="page space-y-6 py-6 sm:py-8">
      <PageHeader
        eyebrow="Admin console"
        title={section === 'people' ? 'People' : section === 'courses' ? 'Courses' : 'Overview'}
        description={
          section === 'people'
            ? 'Everyone on the platform and their global role.'
            : section === 'courses'
              ? 'Create courses, publish them and manage who is enrolled.'
              : 'Live health of your learning platform.'
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New course
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          {
            id: 'courses',
            label: 'Courses',
            badge: courses.data ? <Count n={courses.data.length} /> : null
          },
          {
            id: 'people',
            label: 'People',
            badge: users.data ? <Count n={users.data.users.length} /> : null
          }
        ]}
        activeTab={section}
        onChange={(id) => navigate(id === 'overview' ? '/admin/dashboard' : `/admin/${id}`)}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {section === 'overview' ? (
            <Overview
              courses={courses.data}
              users={users.data}
              loading={courses.isLoading || users.isLoading}
            />
          ) : section === 'courses' ? (
            <CoursesSection
              courses={courses.data}
              loading={courses.isLoading}
              error={courses.error}
            />
          ) : (
            <PeopleSection />
          )}
        </motion.div>
      </AnimatePresence>

      <CreateCourseModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => navigate('/admin/courses')}
      />
    </div>
  );
};

const Count: React.FC<{ n: number }> = ({ n }) => (
  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-500">
    {n}
  </span>
);

/* ---------------------------------------------------------------- overview */

const Overview: React.FC<{
  courses?: Course[];
  users?: { users: PlatformUser[]; stats: Record<BackendRole, number> };
  loading: boolean;
}> = ({ courses = [], users, loading }) => {
  const stats = users?.stats || { trainee: 0, trainer: 0, admin: 0 };
  const totalUsers = stats.trainee + stats.trainer + stats.admin;
  const published = courses.filter((c) => c.status === 'published').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total people"
          icon={<Users />}
          value={loading ? '—' : <CountUp to={totalUsers} />}
        />
        <StatCard
          label="Students"
          icon={<GraduationCap />}
          value={loading ? '—' : <CountUp to={stats.trainee} />}
        />
        <StatCard
          label="Courses"
          icon={<BookOpen />}
          value={loading ? '—' : <CountUp to={courses.length} />}
          hint={`${published} published`}
        />
        <StatCard
          label="Trainers"
          icon={<Presentation />}
          value={loading ? '—' : <CountUp to={stats.trainer} />}
          hint={`${stats.admin} admin${stats.admin === 1 ? '' : 's'}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 rounded-2xl bg-white p-4 shadow-card sm:p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-zinc-900">Role distribution</h3>
          {loading ? (
            <Skeleton className="h-32" />
          ) : (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-100">
                {(Object.keys(roleMeta) as BackendRole[]).map((r) => (
                  <motion.span
                    key={r}
                    className={roleMeta[r].color}
                    initial={{ width: 0 }}
                    animate={{ width: totalUsers ? `${(stats[r] / totalUsers) * 100}%` : 0 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                ))}
              </div>
              <ul className="space-y-2.5">
                {(Object.keys(roleMeta) as BackendRole[]).map((r) => (
                  <li key={r} className="flex items-center gap-3 text-sm">
                    <span className={cn('h-2 w-2 rounded-full', roleMeta[r].color)} />
                    <span className="flex-1 text-zinc-600">{roleMeta[r].label}</span>
                    <span className="font-medium tabular-nums text-zinc-900">{stats[r]}</span>
                    <span className="w-10 text-right text-xs tabular-nums text-zinc-400">
                      {totalUsers ? Math.round((stats[r] / totalUsers) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            to="/admin/people"
            className="inline-flex text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            Manage people →
          </Link>
        </div>

        <div className="min-w-0 rounded-2xl bg-white shadow-card lg:col-span-3">
          <div className="flex items-center justify-between gap-2 p-4 pb-2 sm:p-5 sm:pb-2">
            <h3 className="text-sm font-semibold text-zinc-900">Newest members</h3>
            <Link
              to="/admin/people"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 px-2 pb-2">
              {(users?.users || []).slice(0, 6).map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-2 py-2.5">
                  <Avatar name={u.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-900">{u.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{u.email}</span>
                  </span>
                  <RoleBadge role={u.role} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Recent courses</h3>
          <Link
            to="/admin/courses"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            View all
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : courses.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 3).map((c) => (
              <Link
                key={c.id}
                to={`/admin/course/${c.id}`}
                className="group overflow-hidden rounded-2xl bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <CourseCover seed={c.id} title={c.title} className="aspect-[16/6]" />
                <div className="flex items-center gap-2 p-4">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                    {c.title}
                  </p>
                  <Badge size="sm" variant={statusVariant[c.status]} dot>
                    {c.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen />}
            title="No courses yet"
            description="Create the first course to get your cohort started."
          />
        )}
      </div>
    </div>
  );
};

const RoleBadge: React.FC<{ role: BackendRole }> = ({ role }) => (
  <Badge size="sm" variant={role === 'admin' ? 'green' : role === 'trainer' ? 'blue' : 'gray'}>
    {role === 'trainee' ? 'student' : role}
  </Badge>
);

/* ----------------------------------------------------------------- courses */

const CoursesSection: React.FC<{ courses?: Course[]; loading: boolean; error: unknown }> = ({
  courses = [],
  loading,
  error
}) => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | CourseStatus>('all');
  const [query, setQuery] = useState('');
  const [membersOf, setMembersOf] = useState<Course | null>(null);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CourseStatus }) =>
      lmsApi.updateCourse(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] })
  });

  const visible = courses
    .filter((c) => filter === 'all' || c.status === filter)
    .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses"
          icon={<Search className="h-4 w-4" />}
          containerClassName="sm:max-w-xs"
        />
        <Tabs
          variant="pill"
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'published', label: 'Published' },
            { id: 'draft', label: 'Drafts' },
            { id: 'archived', label: 'Archived' }
          ]}
          activeTab={filter}
          onChange={(id) => setFilter(id as typeof filter)}
          className="sm:ml-auto"
        />
      </div>

      {error ? (
        <EmptyState title="Couldn't load courses" description={(error as Error).message} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : visible.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c, i) => (
            <motion.article
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04 }}
              className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-card"
            >
              <CourseCover seed={c.id} title={c.title} className="aspect-[16/6]" />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start gap-2">
                  <h3 className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-zinc-900">
                    {c.title}
                  </h3>
                  <Badge size="sm" variant={statusVariant[c.status]} dot>
                    {c.status}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                  {c.description || 'No description yet.'}
                </p>
                <p className="mt-3 text-xs text-zinc-400">
                  {c.moduleCount} module{c.moduleCount === 1 ? '' : 's'} · created{' '}
                  {timeAgo(c.createdAt)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                  <Button size="sm" variant="outline" onClick={() => setMembersOf(c)}>
                    <Users className="h-3.5 w-3.5" /> Members
                  </Button>
                  <Link to={`/admin/course/${c.id}`}>
                    <Button size="sm" variant="outline">
                      <PenLine className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </Link>
                  <StatusMenu
                    status={c.status}
                    busy={setStatus.isPending && setStatus.variables?.id === c.id}
                    onChange={(status) => setStatus.mutate({ id: c.id, status })}
                  />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen />}
          title="Nothing here"
          description="No courses match this filter."
        />
      )}

      {setStatus.error ? (
        <p className="text-sm text-red-600">{(setStatus.error as Error).message}</p>
      ) : null}
      <CourseMembersModal course={membersOf} onClose={() => setMembersOf(null)} />
    </div>
  );
};

const StatusMenu: React.FC<{
  status: CourseStatus;
  busy: boolean;
  onChange: (s: CourseStatus) => void;
}> = ({ status, busy, onChange }) => {
  const [open, setOpen] = useState(false);
  const options: { s: CourseStatus; label: string; icon: typeof Eye }[] = [
    { s: 'published', label: 'Publish', icon: Eye },
    { s: 'draft', label: 'Move to drafts', icon: PenLine },
    { s: 'archived', label: 'Archive', icon: Archive }
  ];

  return (
    <div className="relative ml-auto">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        isLoading={busy}
        aria-label="Change status"
      >
        {!busy ? <MoreHorizontal className="h-4 w-4" /> : null}
      </Button>
      <AnimatePresence>
        {open ? (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.ul
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="absolute bottom-full right-0 z-20 mb-1 w-44 origin-bottom-right rounded-xl bg-white p-1 shadow-lift"
            >
              {options
                .filter((o) => o.s !== status)
                .map((o) => (
                  <li key={o.s}>
                    <button
                      onClick={() => {
                        setOpen(false);
                        onChange(o.s);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                    >
                      <o.icon className="h-4 w-4 text-zinc-400" /> {o.label}
                    </button>
                  </li>
                ))}
            </motion.ul>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------ people */

const PeopleSection: React.FC = () => {
  const me = useSelector((s: RootState) => s.auth.user);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | BackendRole>('all');
  const deferred = useDeferredValue(search.trim());

  const users = useQuery({
    queryKey: ['users', deferred],
    queryFn: () => lmsApi.listUsers(deferred),
    placeholderData: (prev) => prev
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: BackendRole }) =>
      lmsApi.updateUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] })
  });

  const list = useMemo(
    () => (users.data?.users || []).filter((u) => roleFilter === 'all' || u.role === roleFilter),
    [users.data, roleFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          icon={<Search className="h-4 w-4" />}
          containerClassName="sm:max-w-xs"
        />
        <Tabs
          variant="pill"
          tabs={[
            { id: 'all', label: 'Everyone' },
            { id: 'trainee', label: 'Students' },
            { id: 'trainer', label: 'Trainers' },
            { id: 'admin', label: 'Admins' }
          ]}
          activeTab={roleFilter}
          onChange={(id) => setRoleFilter(id as typeof roleFilter)}
          className="sm:ml-auto"
        />
      </div>

      {updateRole.error ? (
        <p className="text-sm text-red-600">{(updateRole.error as Error).message}</p>
      ) : null}
      <p className="text-xs text-zinc-500">
        Role changes apply the next time that person signs in or their session refreshes.
      </p>

      {users.error ? (
        <EmptyState title="Couldn't load people" description={(users.error as Error).message} />
      ) : users.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : list.length ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,2fr)_140px_90px] gap-4 border-b border-zinc-100 px-5 py-3 text-xs font-medium text-zinc-500 md:grid">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span className="text-right">Status</span>
          </div>
          <ul className="divide-y divide-zinc-100">
            {list.map((u) => (
              <li
                key={u.id}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_140px_90px] md:gap-4"
              >
                <div className="contents md:flex md:min-w-0 md:items-center md:gap-3">
                  <Avatar name={u.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {u.name}{' '}
                      {u.id === me?.id ? (
                        <span className="text-xs font-normal text-zinc-400">(you)</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-zinc-500 md:hidden">{u.email}</p>
                  </div>
                </div>
                <p className="hidden truncate text-sm text-zinc-600 md:block">{u.email}</p>
                <div className="col-span-2 flex items-center gap-2 md:col-span-1">
                  <Dropdown
                    value={u.role}
                    disabled={
                      u.id === me?.id || (updateRole.isPending && updateRole.variables?.id === u.id)
                    }
                    onChange={(role) => updateRole.mutate({ id: u.id, role: role as BackendRole })}
                    options={[
                      { value: 'trainee', label: 'Student' },
                      { value: 'trainer', label: 'Trainer' },
                      { value: 'admin', label: 'Admin' }
                    ]}
                    containerClassName="w-full md:w-[140px]"
                  />
                  <span className="md:hidden">
                    <VerifiedBadge ok={u.isVerified} />
                  </span>
                </div>
                <div className="hidden justify-end md:flex">
                  <VerifiedBadge ok={u.isVerified} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon={<Users />}
          title="No people found"
          description="Try a different search or filter."
        />
      )}
    </div>
  );
};

const VerifiedBadge: React.FC<{ ok: boolean }> = ({ ok }) =>
  ok ? (
    <Badge size="sm" variant="green" dot>
      verified
    </Badge>
  ) : (
    <Badge size="sm" variant="amber" dot>
      pending
    </Badge>
  );
