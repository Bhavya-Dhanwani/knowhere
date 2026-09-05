import axios from 'axios';
import { store } from '../../app/store';
import { setAccessToken, logout } from '../../features/auth/state/authSlice';

export const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true
});

axiosClient.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let queue: Array<() => void> = [];

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          queue.push(() => resolve(axiosClient(originalRequest)));
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newAccessToken = data?.data?.accessToken || data?.accessToken;
        if (newAccessToken) {
          store.dispatch(setAccessToken(newAccessToken));
        }
        queue.forEach((cb) => cb());
        queue = [];
        return axiosClient(originalRequest);
      } catch (refreshError) {
        store.dispatch(logout());
        window.location.href = '/';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
