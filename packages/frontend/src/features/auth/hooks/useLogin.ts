import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useDispatch } from 'react-redux';
import { authApi } from '../api/authApi';
import { setCredentials } from '../state/authSlice';
import { LoginCredentials } from '../../../shared/types';

export function useLogin() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      dispatch(setCredentials({ accessToken: data.accessToken, user: data.user }));
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      navigate('/dashboard');
    }
  });
}
