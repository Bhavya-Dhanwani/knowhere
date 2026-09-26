import { axiosClient } from '../../../shared/lib/axiosClient';
import { apiErrorMessage, normalizeUser, toBackendRole } from '../../../shared/lib/roles';
import { AuthResponse, LoginCredentials, SignupCredentials, User } from '../../../shared/types';

type Payload = { user?: Record<string, unknown>; accessToken?: string };

const unwrap = (res: { data?: { data?: Payload } & Payload }): Payload =>
  res.data?.data || res.data || {};

// wraps a request so callers always get a readable Error message
async function call<T>(fn: () => Promise<T>, fallback?: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(apiErrorMessage(err, fallback));
  }
}

export const authApi = {
  login: (credentials: LoginCredentials): Promise<AuthResponse> =>
    call(async () => {
      const data = unwrap(await axiosClient.post('/auth/login', credentials));
      return { accessToken: data.accessToken as string, user: normalizeUser(data.user) };
    }, 'Invalid email or password.'),

  signup: (credentials: SignupCredentials): Promise<AuthResponse> =>
    call(async () => {
      const role = credentials.role === 'trainer' ? 'trainer' : 'student';
      const data = unwrap(
        await axiosClient.post('/auth/signup', {
          name: credentials.name.trim(),
          email: credentials.email.trim().toLowerCase(),
          password: credentials.password,
          role: toBackendRole(role)
        })
      );
      return { accessToken: data.accessToken as string, user: normalizeUser(data.user) };
    }),

  refresh: async (): Promise<{ accessToken: string; user: User | null }> => {
    const data = unwrap(await axiosClient.post('/auth/refresh'));
    return {
      accessToken: data.accessToken as string,
      user: data.user ? normalizeUser(data.user) : null
    };
  },

  logout: async (): Promise<void> => {
    await axiosClient.post('/auth/logout').catch(() => undefined);
  },

  getCurrentUser: async (): Promise<User> => {
    const data = unwrap(await axiosClient.get('/auth/me'));
    return normalizeUser(data.user);
  },

  forgotPassword: (email: string) =>
    call(async () => {
      await axiosClient.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
    }),

  resetPassword: (token: string, password: string) =>
    call(async () => {
      await axiosClient.post('/auth/reset-password', { token, password });
    }),

  // full-page redirect into the auth-service Google OAuth flow
  googleUrl: `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/google`
};
