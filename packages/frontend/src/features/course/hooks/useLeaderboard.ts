import { useQuery } from '@tanstack/react-query';
import { courseApi } from '../api/courseApi';

export function useLeaderboard(courseId: string) {
  return useQuery({
    queryKey: ['course', courseId, 'leaderboard'],
    queryFn: () => courseApi.getLeaderboard(courseId),
    enabled: Boolean(courseId),
    staleTime: 1000 * 60 // 1 minute
  });
}
