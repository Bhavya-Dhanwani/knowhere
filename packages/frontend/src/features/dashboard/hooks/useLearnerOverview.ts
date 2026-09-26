import { useQueries, useQuery } from '@tanstack/react-query';
import { lmsApi, Course, CourseProgress } from '../../../shared/api/lms';

export interface LearnerCourse extends Course {
  progress?: CourseProgress;
}

// Courses the learner is a member of (user-service) joined with course-service data and progress.
export function useLearnerOverview() {
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: lmsApi.myProfile });
  const courses = useQuery({ queryKey: ['courses'], queryFn: lmsApi.listCourses });

  const memberIds = new Set((profile.data?.memberships || []).map((m) => m.courseId));
  const all = courses.data || [];
  const enrolled = all.filter((c) => memberIds.has(c.id));
  const discover = all.filter((c) => !memberIds.has(c.id) && c.status === 'published');

  const progress = useQueries({
    queries: enrolled.map((c) => ({
      queryKey: ['progress', c.id],
      queryFn: () => lmsApi.myProgress(c.id),
      staleTime: 60_000
    }))
  });

  const withProgress: LearnerCourse[] = enrolled.map((c, i) => ({
    ...c,
    progress: progress[i]?.data
  }));

  return {
    isLoading: profile.isLoading || courses.isLoading,
    error: profile.error || courses.error,
    profile: profile.data?.profile,
    enrolled: withProgress,
    discover,
    activity: progress.flatMap((p) => (p.data?.completedItems || []).map((i) => i.completedAt)),
    refetch: () => {
      profile.refetch();
      courses.refetch();
    }
  };
}
