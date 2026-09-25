import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useDispatch } from 'react-redux';
import { authApi } from '../api/authApi';
import { setCredentials } from '../state/authSlice';
import { SignupCredentials } from '../../../shared/types';

export function useSignup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: SignupCredentials) => authApi.signup(credentials),
    onSuccess: (data, variables) => {
      const selectedRole = variables.role || data.user.roles?.[0] || 'student';
      const userWithRole = {
        ...data.user,
        roles: data.user.roles?.length ? data.user.roles : [selectedRole]
      };
      dispatch(setCredentials({ accessToken: data.accessToken, user: userWithRole }));
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      if (selectedRole === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  });
}
