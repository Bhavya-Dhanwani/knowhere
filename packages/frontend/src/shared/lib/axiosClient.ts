import axios from 'axios';
import { store } from '../../app/store';
import { setAccessToken, setUser, logout } from '../../features/auth/state/authSlice';
import { normalizeUser } from './roles';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const axiosClient = axios.create({ baseURL, withCredentials: true });

axiosClient.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// auth endpoints report their own 401s (e.g. wrong password); never try to refresh on them
const isAuthEndpoint = (url?: string) =>
  Boolean(url && /\/auth\/(login|signup|refresh|logout)/.test(url));

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data } = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
    const payload = data?.data || data;
    if (payload?.accessToken) {
      store.dispatch(setAccessToken(payload.accessToken));
      if (payload.user) store.dispatch(setUser(normalizeUser(payload.user)));
      return payload.accessToken as string;
    }
  } catch {
    // fall through to logout
  }
  return null;
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      isAuthEndpoint(original.url)
    ) {
      return Promise.reject(error);
    }

    original._retry = true;
    refreshing = refreshing || refreshAccessToken().finally(() => (refreshing = null));
    const token = await refreshing;

    if (!token) {
      store.dispatch(logout());
      if (!['/', '/login', '/signup'].includes(window.location.pathname)) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${token}`;
    return axiosClient(original);
  }
);
