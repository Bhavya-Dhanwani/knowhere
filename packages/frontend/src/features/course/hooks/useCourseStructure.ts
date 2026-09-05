import { useQuery } from '@tanstack/react-query';
import { courseApi } from '../api/courseApi';

export function useCourseStructure(courseId: string) {
  return useQuery({
    queryKey: ['course', courseId, 'structure'],
    queryFn: () => courseApi.getCourseStructure(courseId),
    enabled: Boolean(courseId)
  });
}
