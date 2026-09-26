import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contentApi } from '../api/contentApi';

export const structureKey = (courseId: string) => ['structure', courseId];

export function useCourseStructure(courseId?: string) {
  return useQuery({
    queryKey: structureKey(courseId || ''),
    queryFn: () => contentApi.structure(courseId!),
    enabled: Boolean(courseId)
  });
}

// marks an item complete and refreshes everything that shows progress
export function useCompleteItem(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      code,
      language
    }: {
      itemId: string;
      code?: string;
      language?: string;
    }) => contentApi.complete(courseId, itemId, code, language),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: structureKey(courseId) });
      qc.invalidateQueries({ queryKey: ['progress', courseId] });
    }
  });
}
