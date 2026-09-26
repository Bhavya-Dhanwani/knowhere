import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { useDispatch } from 'react-redux';
import { authApi } from '../api/authApi';
import { setCredentials } from '../state/authSlice';
import { homePathFor, roleOf } from '../../../shared/lib/roles';
import { LoginCredentials } from '../../../shared/types';

export function useLogin() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  // only same-site paths are honoured, never absolute URLs
  const next = params.get('next');
  const safeNext = next && /^\/(?![/\\])/.test(next) ? next : null;

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      queryClient.clear();
      dispatch(setCredentials({ accessToken: data.accessToken, user: data.user }));
      navigate(safeNext || homePathFor(roleOf(data.user)), { replace: true });
    }
  });
}
