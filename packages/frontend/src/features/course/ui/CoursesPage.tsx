import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { BookOpen, Search } from 'lucide-react';
import { RootState } from '../../../app/store';
import { roleOf } from '../../../shared/lib/roles';
import { PageHeader } from '../../../shared/layout/PageHeader';
import { Input } from '../../../shared/ui/Input';
import { Tabs } from '../../../shared/ui/Tabs';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LearnerCourse, useLearnerOverview } from '../../dashboard/hooks/useLearnerOverview';
import { LearnerCourseCard } from '../../dashboard/ui/LearnerCourseCard';

// Course catalog: the learner's enrolled courses plus everything published.
export const CoursesPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const isStaff = roleOf(user) !== 'student';
  const { isLoading, error, enrolled, discover } = useLearnerOverview();
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [query, setQuery] = useState('');

  const enrolledIds = new Set(enrolled.map((c) => c.id));
  const source: LearnerCourse[] = tab === 'mine' ? enrolled : [...enrolled, ...discover];
  const list = source.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="page space-y-6 py-6 sm:py-8">
      <PageHeader
        eyebrow="Catalog"
        title={isStaff ? 'Courses' : 'My courses'}
        description="Everything you're enrolled in, plus published courses you can explore."
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Tabs
          variant="pill"
          tabs={[
            { id: 'mine', label: `Enrolled${enrolled.length ? ` · ${enrolled.length}` : ''}` },
            { id: 'all', label: 'Browse all' }
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses"
          icon={<Search className="h-4 w-4" />}
          containerClassName="sm:ml-auto sm:max-w-xs"
        />
      </div>

      {error ? (
        <EmptyState title="Couldn't load courses" description={(error as Error).message} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : list.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c, i) => (
            <LearnerCourseCard
              key={c.id}
              course={c}
              progress={c.progress}
              index={i}
              cta={enrolledIds.has(c.id) ? 'Continue' : 'Preview'}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen />}
          title={
            query ? 'No matches' : tab === 'mine' ? 'No enrolments yet' : 'No published courses yet'
          }
          description={
            tab === 'mine' && !query
              ? 'When you are added to a cohort it will appear here. Try "Browse all" meanwhile.'
              : undefined
          }
        />
      )}
    </div>
  );
};
