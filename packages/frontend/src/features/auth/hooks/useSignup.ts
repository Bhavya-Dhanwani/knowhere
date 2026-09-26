import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useDispatch } from 'react-redux';
import { authApi } from '../api/authApi';
import { setCredentials } from '../state/authSlice';
import { homePathFor, roleOf } from '../../../shared/lib/roles';
import { SignupCredentials } from '../../../shared/types';

export function useSignup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: SignupCredentials) => authApi.signup(credentials),
    onSuccess: (data) => {
      queryClient.clear();
      dispatch(setCredentials({ accessToken: data.accessToken, user: data.user }));
      navigate(homePathFor(roleOf(data.user)), { replace: true });
    }
  });
}
