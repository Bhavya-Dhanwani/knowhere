import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { authApi } from '../api/authApi';
import { RootState } from '../../../app/store';

export function useCurrentUser() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5
  });
}
