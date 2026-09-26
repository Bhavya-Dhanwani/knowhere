import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { logout } from '../state/authSlice';
import { closeSocket } from '../../chat/api/socket';

export function useLogout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await authApi.logout();
    closeSocket();
    dispatch(logout());
    queryClient.clear();
    navigate('/', { replace: true });
  }, [dispatch, navigate, queryClient]);
}
