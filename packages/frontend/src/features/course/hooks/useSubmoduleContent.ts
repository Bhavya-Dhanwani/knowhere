import { useQuery } from '@tanstack/react-query';
import { courseApi } from '../api/courseApi';

export function useSubmoduleContent(contentItemId: string | null) {
  return useQuery({
    queryKey: ['content-item', contentItemId, 'detail'],
    queryFn: () => courseApi.getSubmoduleContent(contentItemId as string),
    enabled: Boolean(contentItemId)
  });
}
