import React from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, MessagesSquare } from 'lucide-react';
import { RootState } from '../../../app/store';
import { lmsApi } from '../../../shared/api/lms';
import { roleOf } from '../../../shared/lib/roles';
import { PageHeader } from '../../../shared/layout/PageHeader';
import { CourseCover } from '../../../shared/ui/CourseCover';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Skeleton } from '../../../shared/ui/Skeleton';

// Every course has its own community; this lists the ones you belong to.
export const CommunitiesPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const isAdmin = roleOf(user) === 'admin';
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: lmsApi.myProfile });
  const courses = useQuery({ queryKey: ['courses'], queryFn: lmsApi.listCourses });

  const mine = new Set((profile.data?.memberships || []).map((m) => m.courseId));
  const list = (courses.data || []).filter((c) => isAdmin || mine.has(c.id));

  return (
    <div className="page space-y-6 py-6 sm:py-8">
      <PageHeader
        eyebrow="Community"
        title="Your course communities"
        description="Each course has its own channels, voice rooms and members. Only people enrolled in the course can join."
      />
      {profile.isLoading || courses.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Link
              key={c.id}
              to={`/course/${c.id}/community`}
              className="group overflow-hidden rounded-2xl bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <CourseCover seed={c.id} title={c.title} className="aspect-[16/6]" />
              <div className="flex items-center gap-3 p-4">
                <MessagesSquare className="h-4 w-4 shrink-0 text-brand-600" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                  {c.title}
                </p>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:text-zinc-900" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<MessagesSquare />}
          title="No communities yet"
          description="You'll get access to a course's community as soon as you're enrolled."
        />
      )}
    </div>
  );
};
