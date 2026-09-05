import { axiosClient } from '../../../shared/lib/axiosClient';
import { AuthResponse, LoginCredentials, SignupCredentials, User } from '../../../shared/types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await axiosClient.post('/auth/login', credentials);
    const data = response.data?.data || response.data;
    return {
      accessToken: data.accessToken,
      user: data.user
    };
  },

  signup: async (credentials: SignupCredentials): Promise<AuthResponse> => {
    const response = await axiosClient.post('/auth/signup', credentials);
    const data = response.data?.data || response.data;
    return {
      accessToken: data.accessToken,
      user: data.user
    };
  },

  refresh: async (): Promise<{ accessToken: string }> => {
    const response = await axiosClient.post('/auth/refresh');
    const data = response.data?.data || response.data;
    return {
      accessToken: data.accessToken
    };
  },

  logout: async (): Promise<void> => {
    await axiosClient.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await axiosClient.get('/auth/me');
    return response.data?.data || response.data;
  }
};
