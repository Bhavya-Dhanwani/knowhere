import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboardApi';

export function useHeatmapData() {
  return useQuery({
    queryKey: ['dashboard', 'heatmap'],
    queryFn: dashboardApi.getHeatmapData,
    staleTime: 1000 * 60 // 1 minute
  });
}
