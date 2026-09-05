import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboardApi';

export function useEnrolledCourses() {
  return useQuery({
    queryKey: ['courses', 'enrolled'],
    queryFn: dashboardApi.getEnrolledCourses
  });
}
