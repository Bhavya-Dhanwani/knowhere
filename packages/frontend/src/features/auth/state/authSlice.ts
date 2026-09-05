import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, User } from '../../../shared/types';

const getInitialState = (): AuthState => {
  if (typeof window === 'undefined') {
    return { accessToken: null, user: null, isAuthenticated: false };
  }
  const token = localStorage.getItem('accessToken');
  let user: User | null = null;
  try {
    const raw = localStorage.getItem('user');
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }
  return {
    accessToken: token,
    user,
    isAuthenticated: Boolean(token)
  };
};

const initialState: AuthState = getInitialState();

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ accessToken: string; user: User }>) => {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', action.payload.accessToken);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      }
    },
    setAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      state.isAuthenticated = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', action.payload);
      }
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(action.payload));
      }
    },
    logout: (state) => {
      state.accessToken = null;
      state.user = null;
      state.isAuthenticated = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    }
  }
});

export const { setCredentials, setAccessToken, setUser, logout } = authSlice.actions;
export default authSlice.reducer;
