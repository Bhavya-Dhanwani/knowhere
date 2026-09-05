import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboardApi';

export function useNotifications() {
  return useQuery({
    queryKey: ['dashboard', 'notifications'],
    queryFn: dashboardApi.getNotifications
  });
}
